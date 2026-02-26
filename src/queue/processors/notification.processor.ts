// src/queue/processors/notification.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../queue.constants';
import { NotificationJobData } from '../queue.service';

@Processor(QueueName.NOTIFICATIONS)
export class NotificationJobProcessor {
  private readonly logger = new Logger(NotificationJobProcessor.name);
  private readonly concurrency = 5;

  @Process({ concurrency: 5 })
  async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const { userId, type, title, message, data } = job.data;

    this.logger.log(
      `Processing notification job ${job.id} for user ${userId}, type: ${type}`,
    );

    try {
      await job.progress(10);

      if (!userId || !type || !message) {
        throw new Error('Invalid notification data');
      }

      await job.progress(30);
      await this.sendNotification(job.data);
      await job.progress(70);
      await this.storeNotification(job.data);
      await job.progress(100);

      this.logger.log(
        `Notification sent successfully to user ${userId}: ${title}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notification job ${job.id}:`,
        error.stack,
      );
      throw error;
    }
  }

  @Process({ name: 'bulk-notification', concurrency: 5 })
  async processBulkNotification(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(`Processing bulk notification job ${job.id}`);
    await this.processNotification(job);
  }

  @OnQueueActive()
  onActive(job: Job<NotificationJobData>): void {
    this.logger.debug(`Job ${job.id} is now active. User: ${job.data.userId}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<NotificationJobData>, result: any): void {
    this.logger.log(
      `Job ${job.id} completed successfully for user ${job.data.userId}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<NotificationJobData>, error: Error): void {
    const attempts = job.opts.attempts || 3;
    this.logger.error(
      `Job ${job.id} failed for user ${job.data.userId}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );

    if (job.attemptsMade >= attempts) {
      this.logger.error(
        `Job ${job.id} permanently failed after ${job.attemptsMade} attempts.`,
      );
    }
  }

  private async sendNotification(data: NotificationJobData): Promise<void> {
    await this.simulateAsyncOperation(100);

    const notificationId = this.generateNotificationId(data);
    const alreadySent = await this.isNotificationSent(notificationId);

    if (alreadySent) {
      this.logger.warn(`Notification ${notificationId} already sent, skipping`);
      return;
    }

    this.logger.debug(
      `Sending ${data.type} notification to user ${data.userId}`,
    );
  }

  private async storeNotification(data: NotificationJobData): Promise<void> {
    await this.simulateAsyncOperation(50);
    this.logger.debug(`Notification stored for user ${data.userId}`);
  }

  private generateNotificationId(data: NotificationJobData): string {
    return `${data.userId}-${data.type}-${JSON.stringify(data.data)}`;
  }

  private async isNotificationSent(notificationId: string): Promise<boolean> {
    return false;
  }

  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
