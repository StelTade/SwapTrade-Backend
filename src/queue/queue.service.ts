// src/queue/queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job, JobOptions } from 'bull';
import { QueueName } from './queue.constants';

export interface NotificationJobData {
  userId: string;
  type:
    | 'trade_completed'
    | 'trade_disputed'
    | 'message_received'
    | 'system_alert';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailJobData {
  to: string | string[];
  subject: string;
  template: string;
  context?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface ReportJobData {
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  userId?: string;
  startDate: Date;
  endDate: Date;
  format: 'pdf' | 'csv' | 'xlsx';
  email?: string;
  filters?: Record<string, any>;
}

export interface CleanupJobData {
  type: 'old_trades' | 'expired_sessions' | 'temp_files' | 'logs';
  olderThan?: Date;
  batchSize?: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS)
    private notificationQueue: Queue<NotificationJobData>,
    @InjectQueue(QueueName.EMAILS)
    private emailQueue: Queue<EmailJobData>,
    @InjectQueue(QueueName.REPORTS)
    private reportQueue: Queue<ReportJobData>,
    @InjectQueue(QueueName.CLEANUP)
    private cleanupQueue: Queue<CleanupJobData>,
  ) {}

  async addNotificationJob(
    data: NotificationJobData,
    options?: JobOptions,
  ): Promise<Job<NotificationJobData>> {
    try {
      const jobOptions: JobOptions = {
        ...options,
        priority: this.getPriority(data.priority),
      };

      const job = await this.notificationQueue.add(data, jobOptions);

      this.logger.log(
        `Notification job added: ${job.id} for user ${data.userId}`,
      );

      return job;
    } catch (error) {
      this.logger.error('Failed to add notification job:', error);
      throw error;
    }
  }

  async addBulkNotifications(
    notifications: NotificationJobData[],
  ): Promise<Job<NotificationJobData>[]> {
    try {
      const jobs = notifications.map((data) => ({
        name: 'bulk-notification',
        data,
        opts: { priority: this.getPriority(data.priority) },
      }));

      const addedJobs = await this.notificationQueue.addBulk(jobs);

      this.logger.log(`Bulk notifications added: ${addedJobs.length} jobs`);

      return addedJobs;
    } catch (error) {
      this.logger.error('Failed to add bulk notifications:', error);
      throw error;
    }
  }

  async addEmailJob(
    data: EmailJobData,
    options?: JobOptions,
  ): Promise<Job<EmailJobData>> {
    try {
      const job = await this.emailQueue.add(data, options);

      this.logger.log(
        `Email job added: ${job.id} to ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`,
      );

      return job;
    } catch (error) {
      this.logger.error('Failed to add email job:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(
    email: string,
    name: string,
  ): Promise<Job<EmailJobData>> {
    return this.addEmailJob({
      to: email,
      subject: 'Welcome to SwapTrade!',
      template: 'welcome',
      context: { name },
    });
  }

  async sendTradeCompletedEmail(
    email: string,
    tradeDetails: any,
  ): Promise<Job<EmailJobData>> {
    return this.addEmailJob({
      to: email,
      subject: 'Trade Completed Successfully',
      template: 'trade-completed',
      context: { trade: tradeDetails },
    });
  }

  async addReportJob(
    data: ReportJobData,
    options?: JobOptions,
  ): Promise<Job<ReportJobData>> {
    try {
      const job = await this.reportQueue.add(data, {
        ...options,
        priority: 5,
      });

      this.logger.log(`Report job added: ${job.id} type=${data.reportType}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to add report job:', error);
      throw error;
    }
  }

  async generateDailyReport(email?: string): Promise<Job<ReportJobData>> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    return this.addReportJob({
      reportType: 'daily',
      startDate: yesterday,
      endDate: endOfYesterday,
      format: 'pdf',
      email,
    });
  }

  async addCleanupJob(
    data: CleanupJobData,
    options?: JobOptions,
  ): Promise<Job<CleanupJobData>> {
    try {
      const job = await this.cleanupQueue.add(data, {
        ...options,
        priority: 10,
      });

      this.logger.log(`Cleanup job added: ${job.id} type=${data.type}`);

      return job;
    } catch (error) {
      this.logger.error('Failed to add cleanup job:', error);
      throw error;
    }
  }

  async cleanupOldTrades(daysOld = 90): Promise<Job<CleanupJobData>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.addCleanupJob({
      type: 'old_trades',
      olderThan: cutoffDate,
      batchSize: 1000,
    });
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.warn(`Queue paused: ${queueName}`);
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue resumed: ${queueName}`);
  }

  async emptyQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.empty();
    this.logger.warn(`Queue emptied: ${queueName}`);
  }

  async getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job removed: ${jobId} from ${queueName}`);
    }
  }

  async retryJob(queueName: QueueName, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`Job retried: ${jobId} from ${queueName}`);
    }
  }

  private getQueue(queueName: QueueName): Queue {
    switch (queueName) {
      case QueueName.NOTIFICATIONS:
        return this.notificationQueue;
      case QueueName.EMAILS:
        return this.emailQueue;
      case QueueName.REPORTS:
        return this.reportQueue;
      case QueueName.CLEANUP:
        return this.cleanupQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  private getPriority(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 5;
      case 'low':
        return 10;
      default:
        return 5;
    }
  }

  async closeAllQueues(): Promise<void> {
    this.logger.log('Closing all queues gracefully...');

    await Promise.all([
      this.notificationQueue.close(),
      this.emailQueue.close(),
      this.reportQueue.close(),
      this.cleanupQueue.close(),
    ]);

    this.logger.log('All queues closed');
  }
}
