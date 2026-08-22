import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  WebhookSubscription,
  WebhookStatus,
} from '../entities/webhook-subscription.entity';
import { WebhookDeliveryLog } from '../entities/webhook-delivery-log.entity';

const RETENTION_DAYS = 30;

@Injectable()
export class WebhookCleanupService {
  private readonly logger = new Logger(WebhookCleanupService.name);

  constructor(
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLog>,
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
  ) {}

  /**
   * Run daily at 03:00 UTC to clean up expired delivery logs.
   * Retention policy: 30 days.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredDeliveryLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    this.logger.log(
      `Cleaning up delivery logs older than ${RETENTION_DAYS} days (before ${cutoffDate.toISOString()})`,
    );

    const result = await this.deliveryLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(
      `Cleaned up ${result.affected ?? 0} expired webhook delivery logs`,
    );
  }

  /**
   * Run hourly to disable webhooks that have exceeded max consecutive failures.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async disableBrokenWebhooks(): Promise<void> {
    const brokenWebhooks = await this.subscriptionRepository.find({
      where: {
        status: WebhookStatus.ACTIVE,
      },
    });

    let disabledCount = 0;

    for (const webhook of brokenWebhooks) {
      if (webhook.consecutiveFailures >= webhook.maxFailures) {
        webhook.status = WebhookStatus.DISABLED;
        await this.subscriptionRepository.save(webhook);
        disabledCount++;
        this.logger.warn(
          `Auto-disabled webhook ${webhook.id} for user ${webhook.userId} ` +
            `(${webhook.consecutiveFailures}/${webhook.maxFailures} failures)`,
        );
      }
    }

    if (disabledCount > 0) {
      this.logger.log(
        `Auto-disabled ${disabledCount} webhooks with excessive failures`,
      );
    }
  }

  /**
   * Get retention policy information for monitoring.
   */
  getRetentionInfo(): { retentionDays: number; cutoffDate: Date } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    return { retentionDays: RETENTION_DAYS, cutoffDate };
  }
}
