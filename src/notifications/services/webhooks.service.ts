import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { QueueName } from '../../queue/queue.constants';
import {
  WebhookSubscription,
  WebhookStatus,
} from '../entities/webhook-subscription.entity';
import {
  WebhookDeliveryLog,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery-log.entity';
import { RegisterWebhookDto } from '../dto/register-webhook.dto';
import { UpdateWebhookDto } from '../dto/update-webhook.dto';
import {
  WebhookResponseDto,
  WebhookDeliveryLogResponseDto,
} from '../dto/webhook-response.dto';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';

const SIGNING_HEADER = 'X-Webhook-Signature';
const EVENT_ID_HEADER = 'X-Webhook-Event-Id';
const TIMESTAMP_HEADER = 'X-Webhook-Timestamp';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
    @InjectQueue(QueueName.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  // ── Webhook Subscription CRUD ──

  async registerWebhook(
    userId: string,
    dto: RegisterWebhookDto,
  ): Promise<{ subscription: WebhookResponseDto; secret: string }> {
    const secret = this.generateSecret();
    const hashedSecret = this.hashSecret(secret);

    const subscription = this.subscriptionRepository.create({
      userId,
      callbackUrl: dto.callbackUrl,
      secret: hashedSecret,
      status: WebhookStatus.ACTIVE,
      events: dto.events || [],
      description: dto.description,
      maxFailures: dto.maxFailures ?? 10,
    });

    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(
      `Webhook registered for user ${userId}: ${saved.id} -> ${dto.callbackUrl}`,
    );

    return {
      subscription: this.toResponseDto(saved),
      secret, // Only returned once — caller must store it
    };
  }

  async getWebhooks(userId: string): Promise<WebhookResponseDto[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return subscriptions.map((s) => this.toResponseDto(s));
  }

  async getWebhookById(
    userId: string,
    webhookId: string,
  ): Promise<WebhookResponseDto> {
    const subscription = await this.subscriptionRepository.findOneBy({
      id: webhookId,
      userId,
    });
    if (!subscription) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }
    return this.toResponseDto(subscription);
  }

  async updateWebhook(
    userId: string,
    webhookId: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    const subscription = await this.subscriptionRepository.findOneBy({
      id: webhookId,
      userId,
    });
    if (!subscription) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    if (dto.callbackUrl !== undefined) subscription.callbackUrl = dto.callbackUrl;
    if (dto.events !== undefined) subscription.events = dto.events;
    if (dto.description !== undefined) subscription.description = dto.description;
    if (dto.status !== undefined) subscription.status = dto.status;
    if (dto.maxFailures !== undefined) subscription.maxFailures = dto.maxFailures;

    // Reset consecutive failures when reactivating
    if (dto.status === WebhookStatus.ACTIVE) {
      subscription.consecutiveFailures = 0;
    }

    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(`Webhook ${webhookId} updated for user ${userId}`);
    return this.toResponseDto(saved);
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findOneBy({
      id: webhookId,
      userId,
    });
    if (!subscription) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    await this.subscriptionRepository.remove(subscription);
    this.logger.log(`Webhook ${webhookId} deleted for user ${userId}`);
  }

  async rotateSecret(
    userId: string,
    webhookId: string,
  ): Promise<{ secret: string; subscription: WebhookResponseDto }> {
    const subscription = await this.subscriptionRepository.findOneBy({
      id: webhookId,
      userId,
    });
    if (!subscription) {
      throw new NotFoundException(`Webhook ${webhookId} not found`);
    }

    const secret = this.generateSecret();
    subscription.secret = this.hashSecret(secret);
    const saved = await this.subscriptionRepository.save(subscription);

    this.logger.log(`Webhook secret rotated for ${webhookId}`);
    return { secret, subscription: this.toResponseDto(saved) };
  }

  // ── Event Dispatching ──

  /**
   * Dispatch an event to all matching webhook subscriptions for a user.
   * Creates a delivery log entry and enqueues a Bull job for async delivery.
   */
  async dispatchEvent(
    userId: string,
    eventType: NotificationEventType,
    payload: Record<string, any>,
  ): Promise<void> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId, status: WebhookStatus.ACTIVE },
    });

    const matchingSubscriptions = subscriptions.filter((sub) => {
      // Empty events array means "all events"
      return sub.events.length === 0 || sub.events.includes(eventType);
    });

    for (const subscription of matchingSubscriptions) {
      const eventId = uuidv4();
      const timestamp = new Date().toISOString();
      const body = {
        eventId,
        eventType,
        timestamp,
        data: payload,
        resourceLinks: this.buildResourceLinks(eventType, payload),
      };

      const signature = this.signPayload(subscription.secret, body);

      // Create delivery log entry
      const deliveryLog = this.deliveryLogRepository.create({
        subscriptionId: subscription.id,
        userId,
        eventId,
        eventType,
        status: WebhookDeliveryStatus.PENDING,
        payload: body,
        signature,
        attemptNumber: 1,
        maxAttempts: 5,
      });

      const savedLog = await this.deliveryLogRepository.save(deliveryLog);

      // Enqueue for async delivery with exponential backoff
      await this.notificationsQueue.add(
        'webhook-deliver',
        {
          deliveryLogId: savedLog.id,
          subscriptionId: subscription.id,
          callbackUrl: subscription.callbackUrl,
          secret: subscription.secret,
          signingAlgorithm: subscription.signingAlgorithm,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s, 16s, 32s
          },
          priority: 3,
        },
      );

      this.logger.log(
        `Webhook event ${eventId} (${eventType}) enqueued for subscription ${subscription.id}`,
      );
    }
  }

  // ── Delivery Log Queries ──

  async getDeliveryLogs(
    userId: string,
    subscriptionId?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ logs: WebhookDeliveryLogResponseDto[]; total: number }> {
    const where: Record<string, any> = { userId };
    if (subscriptionId) {
      where.subscriptionId = subscriptionId;
    }

    const [logs, total] = await this.deliveryLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      logs: logs.map((l) => this.toDeliveryLogResponseDto(l)),
      total,
    };
  }

  // ── Failure Handling ──

  /**
   * Called after a delivery attempt succeeds.
   */
  async recordDeliverySuccess(deliveryLogId: string): Promise<void> {
    const log = await this.deliveryLogRepository.findOneBy({
      id: deliveryLogId,
    });
    if (!log) return;

    log.status = WebhookDeliveryStatus.SUCCESS;
    log.lastAttemptedAt = new Date();
    await this.deliveryLogRepository.save(log);

    // Reset consecutive failures on the subscription
    const subscription = await this.subscriptionRepository.findOneBy({
      id: log.subscriptionId,
    });
    if (subscription) {
      subscription.consecutiveFailures = 0;
      subscription.lastSuccessfulDeliveryAt = new Date();
      await this.subscriptionRepository.save(subscription);
    }
  }

  /**
   * Called after a delivery attempt fails.
   * Auto-disables the webhook if consecutive failures exceed the threshold.
   */
  async recordDeliveryFailure(
    deliveryLogId: string,
    statusCode?: number,
    responseBody?: string,
    errorMessage?: string,
  ): Promise<void> {
    const log = await this.deliveryLogRepository.findOneBy({
      id: deliveryLogId,
    });
    if (!log) return;

    log.status = WebhookDeliveryStatus.FAILED;
    log.responseStatusCode = statusCode ?? null;
    log.responseBody = responseBody?.substring(0, 1024) ?? null;
    log.errorMessage = errorMessage ?? null;
    log.lastAttemptedAt = new Date();
    await this.deliveryLogRepository.save(log);

    // Increment consecutive failures on the subscription
    const subscription = await this.subscriptionRepository.findOneBy({
      id: log.subscriptionId,
    });
    if (subscription) {
      subscription.consecutiveFailures += 1;
      subscription.lastFailedDeliveryAt = new Date();

      if (subscription.consecutiveFailures >= subscription.maxFailures) {
        subscription.status = WebhookStatus.DISABLED;
        this.logger.warn(
          `Webhook ${subscription.id} auto-disabled after ${subscription.consecutiveFailures} consecutive failures`,
        );
      }

      await this.subscriptionRepository.save(subscription);
    }
  }

  // ── Cleanup ──

  /**
   * Delete delivery logs older than the specified retention period (default 30 days).
   */
  async cleanupExpiredLogs(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.deliveryLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(
      `Cleaned up ${result.affected} delivery logs older than ${retentionDays} days`,
    );
    return result.affected ?? 0;
  }

  // ── HMAC Signing ──

  /**
   * Sign a payload using HMAC-SHA256 with the webhook's secret.
   */
  signPayload(secret: string, payload: Record<string, any>): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify a payload signature against the expected signature.
   */
  verifySignature(
    secret: string,
    payload: Record<string, any>,
    receivedSignature: string,
  ): boolean {
    const expectedSignature = this.signPayload(secret, payload);
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature),
    );
  }

  // ── Private Helpers ──

  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private toResponseDto(subscription: WebhookSubscription): WebhookResponseDto {
    return {
      id: subscription.id,
      callbackUrl: subscription.callbackUrl,
      secretPreview: `${subscription.secret.substring(0, 8)}...`,
      status: subscription.status,
      events: subscription.events,
      description: subscription.description,
      maxFailures: subscription.maxFailures,
      consecutiveFailures: subscription.consecutiveFailures,
      lastSuccessfulDeliveryAt: subscription.lastSuccessfulDeliveryAt,
      lastFailedDeliveryAt: subscription.lastFailedDeliveryAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private toDeliveryLogResponseDto(
    log: WebhookDeliveryLog,
  ): WebhookDeliveryLogResponseDto {
    return {
      id: log.id,
      subscriptionId: log.subscriptionId,
      eventId: log.eventId,
      eventType: log.eventType,
      status: log.status,
      responseStatusCode: log.responseStatusCode,
      durationMs: log.durationMs,
      attemptNumber: log.attemptNumber,
      maxAttempts: log.maxAttempts,
      errorMessage: log.errorMessage,
      nextRetryAt: log.nextRetryAt,
      lastAttemptedAt: log.lastAttemptedAt,
      createdAt: log.createdAt,
    };
  }

  private buildResourceLinks(
    eventType: NotificationEventType,
    payload: Record<string, any>,
  ): Record<string, string> {
    const links: Record<string, string> = {};

    if (payload.orderId) {
      links.order = `/api/orders/${payload.orderId}`;
    }
    if (payload.tradeId) {
      links.trade = `/api/trades/${payload.tradeId}`;
    }
    if (payload.depositId) {
      links.deposit = `/api/deposits/${payload.depositId}`;
    }
    if (payload.withdrawalId) {
      links.withdrawal = `/api/withdrawals/${payload.withdrawalId}`;
    }
    if (payload.kycRecordId) {
      links.kyc = `/api/kyc/${payload.kycRecordId}`;
    }
    if (payload.txHash) {
      links.transaction = `/api/transactions/${payload.txHash}`;
    }

    return links;
  }
}
