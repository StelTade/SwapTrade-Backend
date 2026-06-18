// src/queue/scheduler-failover.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { QueueName } from './queue.constants';
import { QueueMonitoringService } from './queue-monitoring.service';
import { QueueAnalyticsService } from './queue-analytics.service';
import { DeadLetterQueueService, DLQReason } from './dead-letter-queue.service';

export interface FailedJobInfo {
  id: string;
  queue: string;
  failedAt: Date;
  error: string;
  attempts: number;
  data?: any;
}

@Injectable()
export class SchedulerFailoverService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerFailoverService.name);
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly FAILED_JOB_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS)
    private notificationQueue: Queue,
    @InjectQueue(QueueName.REPORTS)
    private reportQueue: Queue,
    private readonly queueMonitoring: QueueMonitoringService,
    private readonly queueAnalytics: QueueAnalyticsService,
    private readonly dlqService: DeadLetterQueueService,
  ) {}

  onModuleInit() {
    this.logger.log('Scheduler Failover Service initialized');
    this.setupFailedJobHandlers();
  }

  private setupFailedJobHandlers() {
    // Listen to global queue error events
    const queues = [this.notificationQueue, this.reportQueue];

    for (const queue of queues) {
      queue.on('error', (error) => {
        this.logger.error(`Queue ${queue.name} error:`, error);
        this.handleQueueError(queue.name, error);
      });

      queue.on('stalled', async (jobId) => {
        this.logger.warn(`Job ${jobId} stalled in queue ${queue.name}`);
        await this.handleStalledJob(queue, jobId.toString());
      });
    }
  }

  // ==================== Health Monitoring (Every 5 minutes) ====================

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'failover-health-check',
  })
  async performFailoverHealthCheck(): Promise<void> {
    this.logger.debug('Running failover health check');

    try {
      const queues = [this.notificationQueue, this.reportQueue];

      for (const queue of queues) {
        const jobCounts = await queue.getJobCounts();

        // Check for excessive failed jobs
        if (jobCounts.failed > 50) {
          this.logger.warn(
            `Queue ${queue.name} has ${jobCounts.failed} failed jobs. Consider investigation.`,
          );

          // Auto-retry failed jobs if count is too high
          if (jobCounts.failed > 100) {
            await this.autoRetryFailedJobs(queue, 10);
          }
        }

        // Check for stalled jobs
        if (jobCounts.active > 100) {
          this.logger.warn(
            `Queue ${queue.name} has ${jobCounts.active} active jobs. Possible stall.`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failover health check failed:', error);
    }
  }

  // ==================== Daily Failed Job Cleanup ====================

  @Cron('0 4 * * *', {
    name: 'daily-failed-job-cleanup',
    timeZone: 'UTC',
  })
  async cleanupOldFailedJobs(): Promise<void> {
    this.logger.log('Running daily failed job cleanup');

    try {
      const queues = [this.notificationQueue, this.reportQueue];
      const cleanedCount = 0;

      for (const queue of queues) {
        const failedJobs = await queue.getFailed(0, 100);

        for (const job of failedJobs) {
          if (
            job.finishedOn &&
            Date.now() - job.finishedOn > this.FAILED_JOB_TTL
          ) {
            await job.remove();
          }
        }
      }

      this.logger.log(`Cleaned up old failed jobs`);
    } catch (error) {
      this.logger.error('Failed job cleanup failed:', error);
    }
  }

  // ==================== Auto-Retry Mechanism ====================

  async autoRetryFailedJobs(
    queue: Queue,
    maxRetries: number = 10,
  ): Promise<number> {
    this.logger.log(`Auto-retrying failed jobs for queue ${queue.name}`);

    try {
      const failedJobs = await queue.getFailed(0, maxRetries);
      let retryCount = 0;

      for (const job of failedJobs) {
        try {
          // Check if job can be retried
          if (await this.canRetryJob(job)) {
            await job.retry();
            retryCount++;
            this.logger.log(`Retried job ${job.id} in queue ${queue.name}`);
          }
        } catch (error) {
          this.logger.error(`Failed to retry job ${job.id}:`, error);

          // Move to DLQ if retry fails
          await this.dlqService.addToDLQ(
            job,
            error,
            DLQReason.NON_RETRYABLE_ERROR,
            queue.name,
          );
        }
      }

      this.logger.log(`Retried ${retryCount} jobs in queue ${queue.name}`);
      return retryCount;
    } catch (error) {
      this.logger.error('Auto-retry failed:', error);
      return 0;
    }
  }

  // ==================== Stalled Job Handler ====================

  async handleStalledJob(queue: Queue, jobId: string): Promise<void> {
    try {
      const job = await queue.getJob(jobId);

      if (!job) {
        this.logger.warn(`Stalled job ${jobId} not found`);
        return;
      }

      // Check if job has exceeded max stalled count
      const maxStalledCount = (job.opts as any)?.maxStalledCount || 1;

      if (job.attemptsMade >= maxStalledCount) {
        this.logger.error(
          `Job ${jobId} has exceeded max stalled count. Moving to DLQ.`,
        );

        await this.dlqService.addToDLQ(
          job,
          new Error('Max stalled count exceeded'),
          DLQReason.STALLED,
          queue.name,
        );
      } else {
        this.logger.warn(`Re-queuing stalled job ${jobId}`);
        await job.retry();
      }
    } catch (error) {
      this.logger.error(`Failed to handle stalled job ${jobId}:`, error);
    }
  }

  // ==================== Queue Error Handler ====================

  async handleQueueError(queueName: string, error: Error): Promise<void> {
    this.logger.error(`Queue ${queueName} error:`, error);

    // Log to monitoring
    try {
      // Record error in monitoring system (simplified approach)
      this.logger.error(`Queue ${queueName} error recorded:`, error.message);
    } catch (monitoringError) {
      this.logger.error('Failed to record queue error:', monitoringError);
    }
  }

  // ==================== Manual Recovery Methods ====================

  async recoverFailedJobs(
    queueName: string,
    limit: number = 50,
  ): Promise<number> {
    this.logger.log(`Manually recovering failed jobs for ${queueName}`);

    const queue =
      queueName === QueueName.NOTIFICATIONS
        ? this.notificationQueue
        : this.reportQueue;

    return await this.autoRetryFailedJobs(queue, limit);
  }

  async getFailedJobsSummary(queueName: string): Promise<any> {
    const queue =
      queueName === QueueName.NOTIFICATIONS
        ? this.notificationQueue
        : this.reportQueue;

    const failedJobs = await queue.getFailed(0, 100);

    return {
      queue: queueName,
      totalFailed: failedJobs.length,
      recentFailures: failedJobs.slice(0, 10).map((job) => ({
        id: job.id,
        failedAt:
          job.finishedOn !== undefined ? new Date(job.finishedOn) : null,
        error: job.failedReason,
        attempts: job.attemptsMade,
      })),
    };
  }

  // ==================== Private Helpers ====================

  private async canRetryJob(job: Job): Promise<boolean> {
    // Don't retry if max attempts reached
    if (job.attemptsMade >= (job.opts.attempts || this.MAX_RETRY_ATTEMPTS)) {
      return false;
    }

    // Don't retry jobs with specific non-retryable errors
    const nonRetryableErrors = [
      'ValidationError',
      'AuthenticationError',
      'PermissionDenied',
    ];

    if (job.failedReason) {
      for (const error of nonRetryableErrors) {
        if (job.failedReason.includes(error)) {
          return false;
        }
      }
    }

    return true;
  }
}
