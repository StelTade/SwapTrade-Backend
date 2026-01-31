// src/queue/dead-letter-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QueueName } from './queue.constants';
import { DEFAULT_DLQ_CONFIG, DLQConfig } from './queue.config';

export interface DLQItem {
  jobId: string;
  queueName: string;
  jobData: any;
  error: string;
  errorStack?: string;
  failedAt: Date;
  lastAttempt: number;
  maxAttempts: number;
  reason: DLQReason;
  metadata?: Record<string, any>;
}

export enum DLQReason {
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  NON_RETRYABLE_ERROR = 'NON_RETRYABLE_ERROR',
  STALLED = 'STALLED',
  TIMEOUT = 'TIMEOUT',
  MANUAL = 'MANUAL',
}

/**
 * Dead Letter Queue Service
 * Handles permanently failed jobs that cannot be retried
 * Maintains history, alerts, and recovery options
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private dlqItems: Map<string, DLQItem[]> = new Map();
  private dlqConfig: DLQConfig = DEFAULT_DLQ_CONFIG;
  private dlqEventListeners: Set<(item: DLQItem) => void> = new Set();

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
    this.initializeDLQ();
  }

  /**
   * Initialize DLQ storage
   */
  private initializeDLQ(): void {
    for (const queue of Object.values(QueueName)) {
      this.dlqItems.set(queue, []);
    }
    this.startCleanupJob();
  }

  /**
   * Add a job to the dead letter queue
   */
  async addToDLQ(
    job: Job,
    error: Error | string,
    reason: DLQReason,
    queueName: string,
  ): Promise<DLQItem> {
    const dlqItem: DLQItem = {
      jobId: job.id.toString(),
      queueName,
      jobData: job.data,
      error:
        typeof error === 'string' ? error : error.message || 'Unknown error',
      errorStack: typeof error === 'string' ? undefined : error.stack,
      failedAt: new Date(),
      lastAttempt: job.attemptsMade || 0,
      maxAttempts: job.opts.attempts || 3,
      reason,
      metadata: {
        priority: job.opts.priority,
        createdAt: job.timestamp,
        processedBy: job.processedOn,
      },
    };

    const queueDLQ = this.dlqItems.get(queueName) || [];
    queueDLQ.push(dlqItem);
    this.dlqItems.set(queueName, queueDLQ);

    this.logger.error(
      `Job ${job.id} moved to DLQ - Reason: ${reason}, Error: ${dlqItem.error}`,
    );

    // Notify listeners
    this.notifyDLQListeners(dlqItem);

    // Check if we should alert
    if (this.dlqConfig.notifyOnFailure) {
      await this.alertAdministrators(dlqItem);
    }

    // Check if threshold exceeded
    if (
      queueDLQ.length > this.dlqConfig.alertThreshold &&
      queueDLQ.length % 10 === 0
    ) {
      this.logger.warn(
        `DLQ for ${queueName} has reached ${queueDLQ.length} items`,
      );
    }

    return dlqItem;
  }

  /**
   * Retrieve DLQ items for a specific queue
   */
  getDLQItems(queueName: string, limit?: number): DLQItem[] {
    let items = this.dlqItems.get(queueName) || [];
    if (limit) {
      items = items.slice(-limit);
    }
    return items;
  }

  /**
   * Get DLQ statistics
   */
  getDLQStats(): Record<string, { count: number; oldestItem?: DLQItem }> {
    const stats: Record<string, { count: number; oldestItem?: DLQItem }> = {};

    for (const [queueName, items] of this.dlqItems) {
      stats[queueName] = {
        count: items.length,
        oldestItem: items.length > 0 ? items[0] : undefined,
      };
    }

    return stats;
  }

  /**
   * Attempt to recover and retry a DLQ item
   */
  async recoverJob(queueName: string, jobId: string): Promise<boolean> {
    const items = this.dlqItems.get(queueName) || [];
    const itemIndex = items.findIndex((i) => i.jobId === jobId);

    if (itemIndex === -1) {
      this.logger.warn(
        `DLQ item ${jobId} not found in queue ${queueName}`,
      );
      return false;
    }

    const item = items[itemIndex];
    const queue = this.getQueueByName(queueName);

    if (!queue) {
      this.logger.error(`Queue ${queueName} not found`);
      return false;
    }

    try {
      // Add job back to queue with reset attempts
      await queue.add(item.jobData, {
        attempts: item.maxAttempts,
        priority: item.metadata?.priority,
        delay: 0,
      });

      // Remove from DLQ
      items.splice(itemIndex, 1);

      this.logger.log(
        `Successfully recovered DLQ job ${jobId} from queue ${queueName}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to recover DLQ job ${jobId}:`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Remove a DLQ item permanently
   */
  removeDLQItem(queueName: string, jobId: string): boolean {
    const items = this.dlqItems.get(queueName) || [];
    const itemIndex = items.findIndex((i) => i.jobId === jobId);

    if (itemIndex === -1) {
      return false;
    }

    items.splice(itemIndex, 1);
    this.logger.log(
      `Removed DLQ item ${jobId} from queue ${queueName}`,
    );

    return true;
  }

  /**
   * Clear all DLQ items for a queue
   */
  clearDLQ(queueName: string): number {
    const items = this.dlqItems.get(queueName) || [];
    const count = items.length;
    this.dlqItems.set(queueName, []);

    this.logger.log(`Cleared DLQ for queue ${queueName} (${count} items)`);

    return count;
  }

  /**
   * Get a DLQ item by ID
   */
  getDLQItem(queueName: string, jobId: string): DLQItem | undefined {
    const items = this.dlqItems.get(queueName) || [];
    return items.find((i) => i.jobId === jobId);
  }

  /**
   * Subscribe to DLQ events
   */
  onDLQItem(callback: (item: DLQItem) => void): void {
    this.dlqEventListeners.add(callback);
  }

  /**
   * Unsubscribe from DLQ events
   */
  offDLQItem(callback: (item: DLQItem) => void): void {
    this.dlqEventListeners.delete(callback);
  }

  /**
   * Update DLQ configuration
   */
  setDLQConfig(config: Partial<DLQConfig>): void {
    this.dlqConfig = { ...this.dlqConfig, ...config };
    this.logger.log('DLQ configuration updated');
  }

  /**
   * Get current DLQ configuration
   */
  getDLQConfig(): DLQConfig {
    return this.dlqConfig;
  }

  // ==================== Private Methods ====================

  private notifyDLQListeners(item: DLQItem): void {
    this.dlqEventListeners.forEach((callback) => {
      try {
        callback(item);
      } catch (error) {
        this.logger.error('Error in DLQ event listener:', error);
      }
    });
  }

  private async alertAdministrators(item: DLQItem): Promise<void> {
    // This would integrate with your notification system
    // For now, just log the alert
    this.logger.warn(
      `[DLQ ALERT] Job ${item.jobId} permanently failed in queue ${item.queueName}: ${item.error}`,
    );
  }

  private startCleanupJob(): void {
    // Clean up old DLQ items periodically
    setInterval(() => {
      const cutoffTime = Date.now() - this.dlqConfig.maxAge;

      for (const [queueName, items] of this.dlqItems) {
        const beforeCount = items.length;
        const filtered = items.filter((item) =>
          item.failedAt.getTime() > cutoffTime
        );
        this.dlqItems.set(queueName, filtered);

        if (filtered.length < beforeCount) {
          this.logger.debug(
            `Cleaned up ${beforeCount - filtered.length} old DLQ items from ${queueName}`,
          );
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  private getQueueByName(queueName: string): Queue | null {
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
        return null;
    }
  }
}
