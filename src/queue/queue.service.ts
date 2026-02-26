// src/queue/queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job, JobOptions } from 'bull';
import { QueueName } from './queue.constants';
import type {
  SwapJobData,
  SingleSwapJobData,
  MultiLegSwapJobData,
  BatchSwapJobData,
} from '../swap/swap-batch.processor';

// ── Existing job data interfaces (unchanged) ──────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

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
    @InjectQueue(QueueName.SWAPS)
    private swapQueue: Queue<SwapJobData>,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Swap queue  (new)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Queue a single async swap job.
   */
  async addSingleSwapJob(
    data: SingleSwapJobData,
    options?: JobOptions,
  ): Promise<Job<SingleSwapJobData>> {
    const job = await this.swapQueue.add('single', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: false, // keep for audit
      removeOnFail: false,
      ...options,
    });

    this.logger.log(
      `Single swap job queued: jobId=${job.id} swapId=${data.swapId}`,
    );
    return job as Job<SingleSwapJobData>;
  }

  /**
   * Queue a multi-leg (routed) swap job.
   */
  async addMultiLegSwapJob(
    data: MultiLegSwapJobData,
    options?: JobOptions,
  ): Promise<Job<MultiLegSwapJobData>> {
    const job = await this.swapQueue.add('multi_leg', data, {
      attempts: 2, // fewer retries for complex multi-leg
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
      ...options,
    });

    this.logger.log(
      `Multi-leg swap job queued: jobId=${job.id} batchId=${data.batchId}`,
    );
    return job as Job<MultiLegSwapJobData>;
  }

  /**
   * Queue a batch swap job (multiple swaps processed together).
   */
  async addBatchSwapJob(
    data: BatchSwapJobData,
    options?: JobOptions,
  ): Promise<Job<BatchSwapJobData>> {
    const job = await this.swapQueue.add('batch', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: false,
      removeOnFail: false,
      ...options,
    });

    this.logger.log(
      `Batch swap job queued: jobId=${job.id} batchId=${data.batchId} count=${data.swapIds.length}`,
    );
    return job as Job<BatchSwapJobData>;
  }

  /**
   * Get current swap queue depth.
   */
  async getSwapQueueDepth(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    return this.swapQueue.getJobCounts();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Existing queue methods (unchanged below this line)
  // ──────────────────────────────────────────────────────────────────────────

  async addNotificationJob(
    data: NotificationJobData,
    options?: JobOptions,
  ): Promise<Job<NotificationJobData>> {
    try {
      const job = await this.notificationQueue.add(data, {
        ...options,
        priority: this.getPriority(data.priority),
      });
      this.logger.log(`Notification job added: ${job.id} for user ${data.userId}`);
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

  async sendWelcomeEmail(email: string, name: string): Promise<Job<EmailJobData>> {
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
      const job = await this.reportQueue.add(data, { ...options, priority: 5 });
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
      const job = await this.cleanupQueue.add(data, { ...options, priority: 10 });
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

  async closeAllQueues(): Promise<void> {
    this.logger.log('Closing all queues gracefully…');
    await Promise.all([
      this.notificationQueue.close(),
      this.emailQueue.close(),
      this.reportQueue.close(),
      this.cleanupQueue.close(),
      this.swapQueue.close(),
    ]);
    this.logger.log('All queues closed');
  }

  async getDashboardSummary(): Promise<any> {
    const metrics = await this.getAllQueueMetrics();
    return { totalQueues: 5, metrics, timestamp: new Date() };
  }

  async getAllQueueMetrics(): Promise<any> {
    return {
      notification: await this.getQueueMetrics('notification'),
      email: await this.getQueueMetrics('email'),
      report: await this.getQueueMetrics('report'),
      cleanup: await this.getQueueMetrics('cleanup'),
      swaps: await this.getQueueMetrics('swaps'),
    };
  }

  async getQueueMetrics(queueName: string): Promise<any> {
    const queue = this.getQueueInstance(queueName);
    if (!queue) return null;
    const counts = await queue.getJobCounts();
    return { queue: queueName, ...counts };
  }

  async getQueueJobCount(queueName: string): Promise<number> {
    const queue = this.getQueueInstance(queueName);
    if (!queue) return 0;
    const counts = await queue.getJobCounts();
    return (
      (counts.active || 0) +
      (counts.waiting || 0) +
      (counts.delayed || 0) +
      (counts.completed || 0) +
      (counts.failed || 0)
    );
  }

  async waitUntilEmpty(queueName: string): Promise<void> {
    const queue = this.getQueueInstance(queueName);
    if (!queue) return;
    await queue.whenCurrentJobsFinished();
  }

  async getJobDetails(queueName: string, jobId: string): Promise<any> {
    const queue = this.getQueueInstance(queueName);
    if (!queue) return null;
    const job = await queue.getJob(jobId);
    return job ? job.toJSON() : null;
  }

  async getJobsByStatus(
    queueName: string,
    status: string,
    _start?: number,
    _end?: number,
  ): Promise<any[]> {
    const queue = this.getQueueInstance(queueName);
    if (!queue) return [];

    switch (status) {
      case 'active':    return queue.getActiveJobs();
      case 'waiting':   return queue.getWaitingJobs();
      case 'completed': return queue.getCompletedJobs();
      case 'failed':    return queue.getFailedJobs();
      case 'delayed':   return queue.getDelayedJobs();
      default:          return [];
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private getQueue(queueName: QueueName): Queue {
    switch (queueName) {
      case QueueName.NOTIFICATIONS: return this.notificationQueue;
      case QueueName.EMAILS:        return this.emailQueue;
      case QueueName.REPORTS:       return this.reportQueue;
      case QueueName.CLEANUP:       return this.cleanupQueue;
      case QueueName.SWAPS:         return this.swapQueue;
      default: throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  private getQueueInstance(queueName: string): Queue | null {
    switch (queueName) {
      case 'notification': return this.notificationQueue;
      case 'email':        return this.emailQueue;
      case 'report':       return this.reportQueue;
      case 'cleanup':      return this.cleanupQueue;
      case 'swaps':        return this.swapQueue;
      default:             return null;
    }
  }

  private getPriority(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':   return 1;
      case 'normal': return 5;
      case 'low':    return 10;
      default:       return 5;
    }
  }
}