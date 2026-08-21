import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QueueName } from '../../queue/queue.constants';
import {
  WebhookDeliveryLog,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery-log.entity';
import { WebhooksService } from './webhooks.service';

interface WebhookDeliveryJobData {
  deliveryLogId: string;
  subscriptionId: string;
  callbackUrl: string;
  secret: string;
  signingAlgorithm: string;
}

@Processor(QueueName.NOTIFICATIONS)
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);
  private readonly SIGNATURE_HEADER = 'X-Webhook-Signature';
  private readonly EVENT_ID_HEADER = 'X-Webhook-Event-Id';
  private readonly TIMESTAMP_HEADER = 'X-Webhook-Timestamp';
  private readonly EVENT_TYPE_HEADER = 'X-Webhook-Event-Type';
  private readonly USER_AGENT = 'SwapTrade-Webhook/1.0';
  private readonly TIMEOUT_MS = 10000; // 10-second timeout

  constructor(
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
    private readonly httpService: HttpService,
    private readonly webhooksService: WebhooksService,
  ) {}

  @Process('webhook-deliver')
  async processWebhookDelivery(
    job: Job<WebhookDeliveryJobData>,
  ): Promise<void> {
    const { deliveryLogId, callbackUrl, secret, signingAlgorithm } = job.data;

    const log = await this.deliveryLogRepository.findOneBy({
      id: deliveryLogId,
    });
    if (!log) {
      this.logger.error(
        `Delivery log ${deliveryLogId} not found, skipping webhook delivery`,
      );
      return;
    }

    this.logger.log(
      `Delivering webhook ${log.eventId} (${log.eventType}) to ${callbackUrl} ` +
        `(attempt ${log.attemptNumber}/${log.maxAttempts})`,
    );

    // Update log status
    log.status = WebhookDeliveryStatus.RETRYING;
    log.lastAttemptedAt = new Date();
    await this.deliveryLogRepository.save(log);

    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.post(callbackUrl, log.payload, {
          headers: {
            'Content-Type': 'application/json',
            [this.SIGNATURE_HEADER]: log.signature,
            [this.EVENT_ID_HEADER]: log.eventId,
            [this.TIMESTAMP_HEADER]: new Date(log.createdAt).getTime().toString(),
            [this.EVENT_TYPE_HEADER]: log.eventType,
            'User-Agent': this.USER_AGENT,
          },
          timeout: this.TIMEOUT_MS,
          validateStatus: () => true, // Don't throw on non-2xx
        }),
      );

      const durationMs = Date.now() - startTime;

      if (response.status >= 200 && response.status < 300) {
        // Success
    log.status = WebhookDeliveryStatus.SUCCESS;
    log.responseStatusCode = response.status as number;
    log.durationMs = durationMs;
    log.responseBody =
          typeof response.data === 'string'
            ? response.data.substring(0, 1024)
            : JSON.stringify(response.data).substring(0, 1024);
        await this.deliveryLogRepository.save(log);

        await this.webhooksService.recordDeliverySuccess(deliveryLogId);

        this.logger.log(
          `Webhook ${log.eventId} delivered successfully to ${callbackUrl} ` +
            `(${response.status}, ${durationMs}ms)`,
        );
      } else {
        // Non-2xx response
        throw new Error(
          `Callback returned HTTP ${response.status}: ${
            typeof response.data === 'string'
              ? response.data.substring(0, 500)
              : JSON.stringify(response.data).substring(0, 500)
          }`,
        );
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Extract HTTP status from axios errors
      let statusCode: number | undefined;
      let responseBody: string | undefined;
      if (
        error instanceof Error &&
        'response' in error &&
        typeof (error as any).response === 'object'
      ) {
        statusCode = (error as any).response.status;
        responseBody = JSON.stringify(
          (error as any).response.data,
        ).substring(0, 1024);
      }

      log.status = WebhookDeliveryStatus.FAILED;
      log.responseStatusCode = statusCode ?? null;
      log.durationMs = durationMs;
      log.errorMessage = errorMessage ?? null;
      log.responseBody = responseBody ?? null;
      await this.deliveryLogRepository.save(log);

      await this.webhooksService.recordDeliveryFailure(
        deliveryLogId,
        statusCode,
        responseBody,
        errorMessage,
      );

      this.logger.error(
        `Webhook ${log.eventId} delivery failed to ${callbackUrl}: ${errorMessage}`,
      );

      // Re-throw to trigger Bull's retry mechanism
      throw error;
    }
  }
}
