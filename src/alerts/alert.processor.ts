import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { AlertService } from './alert.service';
import { NotificationService } from '../notification/notification.service';
import type { AlertFireJobData } from './alert-evaluation.service';
import { AlertStatus } from './entities/alert-rule.entity';
import { QueueName } from '../queue/queue.constants';

@Processor(QueueName.ALERTS)
export class AlertProcessor {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly alertService: AlertService,
    private readonly notificationService: NotificationService,
  ) {}

  @Process({ name: 'fire-alert', concurrency: 5 })
  async fireAlert(job: Job<AlertFireJobData>): Promise<void> {
    const { alertId, userId, triggerValue, message, channels, alertName } = job.data;

    this.logger.log(`Processing alert fire: alertId=${alertId} userId=${userId}`);
    await job.progress(10);

    const rules = await this.alertService.getAlerts(userId);
    const rule = rules.find((r) => r.id === alertId);

    if (!rule || rule.status !== AlertStatus.ACTIVE) {
      this.logger.warn(
        `Alert ${alertId} is no longer active (status=${rule?.status ?? 'not found'}), skipping.`,
      );
      return;
    }

    await job.progress(30);

    const notification = await this.notificationService.sendAlert({
      userId,
      message,
      subject: alertName,
      channels,
      type: 'ALERT',
      metadata: { alertId, triggerValue },
    });

    await job.progress(70);

    await this.alertService.recordTrigger(rule, triggerValue, notification?.id ?? null);

    await job.progress(100);
    this.logger.log(`Alert fired successfully: alertId=${alertId}`);
  }

  @OnQueueActive()
  onActive(job: Job<AlertFireJobData>): void {
    this.logger.debug(`Alert job ${job.id} started for alertId=${job.data.alertId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<AlertFireJobData>): void {
    this.logger.log(`Alert job ${job.id} completed for alertId=${job.data.alertId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<AlertFireJobData>, error: Error): void {
    this.logger.error(
      `Alert job ${job.id} failed for alertId=${job.data.alertId}: ${error.message}`,
      error.stack,
    );
  }
}
