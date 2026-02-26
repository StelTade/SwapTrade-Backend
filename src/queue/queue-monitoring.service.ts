// src/queue/queue-monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, JobCounts } from 'bull';
import { QueueName } from './queue.constants';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface QueueMetrics {
  name: string;
  counts: JobCounts;
  isPaused: boolean;
  workers: number;
  failedJobs: any[];
  activeJobs: any[];
  waitingJobs: number;
  processingTime: number;
  successRate: number;
}

export interface JobMetrics {
  jobId: string;
  queueName: string;
  status: string;
  progress: number;
  attempts: number;
  timestamp: Date;
  processingTime?: number;
  error?: string;
}

@Injectable()
export class QueueMonitoringService {
  private readonly logger = new Logger(QueueMonitoringService.name);
  private metrics: Map<string, any[]> = new Map();
  private readonly METRIC_RETENTION_HOURS = 24;

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS)
    private notificationQueue: Queue,
    @InjectQueue(QueueName.EMAILS)
    private emailQueue: Queue,
    @InjectQueue(QueueName.REPORTS)
    private reportQueue: Queue,
    @InjectQueue(QueueName.CLEANUP)
    private cleanupQueue: Queue,
  ) {
    this.initializeEventListeners();
  }

  async getQueueMetrics(queueName: QueueName): Promise<QueueMetrics> {
    const queue = this.getQueue(queueName);

    const [counts, isPaused, workers, failed, active] = await Promise.all([
      queue.getJobCounts(),
      queue.isPaused(),
      queue.getWorkers(),
      queue.getFailed(0, 10),
      queue.getActive(),
    ]);

    const metrics = this.calculateMetrics(queueName);

    return {
      name: queueName,
      counts,
      isPaused,
      workers: workers.length,
      failedJobs: failed.map((job) => ({
        id: String(job.id),
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      })),
      activeJobs: active.map((job) => ({
        id: String(job.id),
        progress: job.progress(),
        timestamp: job.timestamp,
      })),
      waitingJobs: counts.waiting || 0,
      processingTime: metrics.avgProcessingTime,
      successRate: metrics.successRate,
    };
  }

  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    const queueNames = Object.values(QueueName);

    return Promise.all(
      queueNames.map((queueName) => this.getQueueMetrics(queueName)),
    );
  }

  async getJobStatus(
    queueName: QueueName,
    jobId: string,
  ): Promise<JobMetrics | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = await job.progress();

    return {
      jobId: String(job.id),
      queueName,
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      attempts: job.attemptsMade,
      timestamp: new Date(job.timestamp),
      processingTime:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
      error: job.failedReason,
    };
  }

  async getDeadLetterJobs(queueName: QueueName, limit = 50): Promise<any[]> {
    const queue = this.getQueue(queueName);
    const failed = await queue.getFailed(0, limit);

    return failed
      .filter((job) => {
        const attempts = job.opts.attempts || 3;
        return job.attemptsMade >= attempts;
      })
      .map((job) => ({
        id: String(job.id),
        data: job.data,
        error: job.failedReason,
        attempts: job.attemptsMade,
        failedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      }));
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    queues: Record<string, any>;
    alerts: string[];
  }> {
    const alerts: string[] = [];
    const queues: Record<string, any> = {};

    for (const queueName of Object.values(QueueName)) {
      const metrics = await this.getQueueMetrics(queueName);

      queues[queueName] = {
        healthy: !metrics.isPaused,
        waiting: metrics.waitingJobs,
        failed: metrics.counts.failed || 0,
        successRate: metrics.successRate,
      };

      if (metrics.isPaused) {
        alerts.push(`Queue ${queueName} is paused`);
      }

      if (metrics.waitingJobs > 1000) {
        alerts.push(
          `Queue ${queueName} has ${metrics.waitingJobs} waiting jobs`,
        );
      }

      if (metrics.successRate < 0.9) {
        alerts.push(
          `Queue ${queueName} has low success rate: ${(metrics.successRate * 100).toFixed(1)}%`,
        );
      }

      const failedCount = metrics.counts.failed || 0;
      if (failedCount > 100) {
        alerts.push(`Queue ${queueName} has ${failedCount} failed jobs`);
      }
    }

    return {
      healthy: alerts.length === 0,
      queues,
      alerts,
    };
  }

  private calculateMetrics(queueName: string): {
    avgProcessingTime: number;
    successRate: number;
  } {
    const queueMetrics = this.metrics.get(queueName);

    if (!queueMetrics || queueMetrics.length === 0) {
      return { avgProcessingTime: 0, successRate: 1 };
    }

    const totalTime = queueMetrics.reduce(
      (sum, m) => sum + (m.processingTime || 0),
      0,
    );
    const avgProcessingTime = totalTime / queueMetrics.length;

    const successCount = queueMetrics.filter((m) => m.success).length;
    const successRate = successCount / queueMetrics.length;

    return { avgProcessingTime, successRate };
  }

  private recordMetric(
    queueName: string,
    jobId: string,
    success: boolean,
    processingTime: number,
  ): void {
    if (!this.metrics.has(queueName)) {
      this.metrics.set(queueName, []);
    }

    const queueMetrics = this.metrics.get(queueName)!;
    queueMetrics.push({
      jobId,
      success,
      processingTime,
      timestamp: new Date(),
    });

    const cutoff = Date.now() - this.METRIC_RETENTION_HOURS * 3600 * 1000;
    this.metrics.set(
      queueName,
      queueMetrics.filter((m) => m.timestamp.getTime() > cutoff),
    );
  }

  private initializeEventListeners(): void {
    this.setupQueueListeners(QueueName.NOTIFICATIONS, this.notificationQueue);
    this.setupQueueListeners(QueueName.EMAILS, this.emailQueue);
    this.setupQueueListeners(QueueName.REPORTS, this.reportQueue);
    this.setupQueueListeners(QueueName.CLEANUP, this.cleanupQueue);
  }

  /**
   * Verify that all queues can connect to Redis by making a lightweight call to each queue.
   * Throws an error if any queue cannot respond within the timeout.
   */
  async verifyConnections(timeoutMs = 5000): Promise<void> {
    const queues = [
      { name: QueueName.NOTIFICATIONS, queue: this.notificationQueue },
      { name: QueueName.EMAILS, queue: this.emailQueue },
      { name: QueueName.REPORTS, queue: this.reportQueue },
      { name: QueueName.CLEANUP, queue: this.cleanupQueue },
    ];

    const checks = queues.map(async ({ name, queue }) => {
      try {
        await Promise.race([
          // lightweight RPC that will fail if redis is unreachable
          queue.getJobCounts(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs),
          ),
        ]);
      } catch (err) {
        this.logger.error(
          `Queue ${name} failed to connect to Redis: ${err?.message || err}`,
        );
        throw new Error(`Queue ${name} connectivity check failed`);
      }
    });

    await Promise.all(checks);

    this.logger.log('All queues connected to Redis');
  }

  private setupQueueListeners(queueName: QueueName, queue: Queue): void {
    queue.on('completed', (job, result) => {
      const processingTime =
        job.processedOn && job.finishedOn
          ? job.finishedOn - job.processedOn
          : 0;
      this.recordMetric(queueName, String(job.id), true, processingTime);

      this.logger.debug(
        `[${queueName}] Job ${job.id} completed in ${processingTime}ms`,
      );
    });

    queue.on('failed', (job, err) => {
      const processingTime =
        job.processedOn && job.finishedOn
          ? job.finishedOn - job.processedOn
          : 0;
      this.recordMetric(queueName, String(job.id), false, processingTime);

      this.logger.error(`[${queueName}] Job ${job.id} failed: ${err.message}`);
    });

    queue.on('stalled', (job) => {
      this.logger.warn(`[${queueName}] Job ${job.id} stalled`);
    });

    queue.on('error', (error) => {
      this.logger.error(`[${queueName}] Queue error:`, error);
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldJobs(): Promise<void> {
    this.logger.log('Running periodic job cleanup...');

    for (const queueName of Object.values(QueueName)) {
      const queue = this.getQueue(queueName);

      await queue.clean(24 * 3600 * 1000, 'completed');
      await queue.clean(7 * 24 * 3600 * 1000, 'failed');
    }

    this.logger.log('Job cleanup completed');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async logQueueStatus(): Promise<void> {
    const health = await this.getHealthStatus();

    if (health.alerts.length > 0) {
      this.logger.warn(`Queue health alerts: ${health.alerts.join('; ')}`);
    }

    for (const [queueName, metrics] of Object.entries(health.queues)) {
      this.logger.debug(
        `[${queueName}] Waiting: ${metrics.waiting}, ` +
          `Failed: ${metrics.failed}, ` +
          `Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`,
      );
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
}
