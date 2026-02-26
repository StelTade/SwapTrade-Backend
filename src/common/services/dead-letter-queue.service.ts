import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Dead letter queue configuration
 */
export interface DLQConfig {
  maxRetries: number;
  retentionDays: number;
  notifyOnThreshold?: number; // Notify after X messages in DLQ
}

/**
 * Dead letter message
 */
export interface DeadLetterMessage {
  id: string;
  originalJobId?: string;
  queueName: string;
  functionName: string;
  data: any;
  error: {
    code: string;
    message: string;
    stack?: string;
  };
  attempts: number;
  maxRetries: number;
  createdAt: Date;
  failedAt: Date;
  metadata?: Record<string, any>;
  correlationId?: string;
  traceId?: string;
}

/**
 * Service for managing dead letter queues (DLQ)
 * Handles failed job routing and recovery strategies
 */
@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly dlqConfigs = new Map<string, DLQConfig>();
  private readonly dlqMessages = new Map<string, DeadLetterMessage[]>();
  private readonly dlqCallbacks = new Map<string, Set<(msg: DeadLetterMessage) => void>>();

  constructor(
    @Optional()
    @Inject('DeadLetterQueue')
    @InjectQueue('dlq')
    private optional: any,
    private readonly correlationIdService: CorrelationIdService,
  ) {}

  /**
   * Register a dead letter queue for a job queue
   */
  registerDLQ(queueName: string, config: DLQConfig): void {
    this.dlqConfigs.set(queueName, config);
    this.dlqMessages.set(queueName, []);
    this.dlqCallbacks.set(queueName, new Set());

    this.logger.log(`Dead Letter Queue registered for: ${queueName}`);
  }

  /**
   * Send failed job to dead letter queue
   */
  async sendToDLQ(
    queueName: string,
    jobId: string | undefined,
    functionName: string,
    data: any,
    error: Error,
    attempts: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const config = this.dlqConfigs.get(queueName);
    if (!config) {
      this.logger.warn(`DLQ not configured for queue: ${queueName}`);
      return;
    }

    const correlationContext = this.correlationIdService.getFullContext();
    const dlqMessage: DeadLetterMessage = {
      id: this.generateDLQMessageId(),
      originalJobId: jobId,
      queueName,
      functionName,
      data,
      error: {
        code: (error as any).code || 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
      },
      attempts,
      maxRetries: config.maxRetries,
      createdAt: new Date(),
      failedAt: new Date(),
      metadata,
      correlationId: correlationContext?.correlationId,
      traceId: correlationContext?.traceId,
    };

    // Store DLQ message
    const messages = this.dlqMessages.get(queueName) || [];
    messages.push(dlqMessage);
    this.dlqMessages.set(queueName, messages);

    this.logger.warn(`Message sent to DLQ: ${queueName} - ${functionName} (${dlqMessage.id})`);

    // Trigger callbacks
    this.triggerCallbacks(queueName, dlqMessage);

    // Check threshold
    if (config.notifyOnThreshold && messages.length >= config.notifyOnThreshold) {
      this.logger.error(
        `DLQ threshold reached for ${queueName}: ${messages.length} messages in queue`,
      );
    }
  }

  /**
   * Retrieve DLQ messages for a queue
   */
  getDLQMessages(queueName: string, limit?: number): DeadLetterMessage[] {
    const messages = this.dlqMessages.get(queueName) || [];
    if (limit) {
      return messages.slice(0, limit);
    }
    return messages;
  }

  /**
   * Get DLQ message by ID
   */
  getDLQMessage(queueName: string, messageId: string): DeadLetterMessage | undefined {
    const messages = this.dlqMessages.get(queueName) || [];
    return messages.find((m) => m.id === messageId);
  }

  /**
   * Get all DLQ messages across all queues
   */
  getAllDLQMessages(): Map<string, DeadLetterMessage[]> {
    return this.dlqMessages;
  }

  /**
   * Get DLQ statistics
   */
  getDLQStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [queueName, messages] of this.dlqMessages.entries()) {
      stats[queueName] = {
        totalMessages: messages.length,
        config: this.dlqConfigs.get(queueName),
        oldestMessage: messages.length > 0 ? messages[0].failedAt : null,
        newestMessage: messages.length > 0 ? messages[messages.length - 1].failedAt : null,
        errors: this.groupErrorsByCode(messages),
      };
    }

    return stats;
  }

  /**
   * Retry a DLQ message
   */
  async retryDLQMessage(
    queueName: string,
    messageId: string,
    retryFn: (data: any) => Promise<any>,
  ): Promise<boolean> {
    const messages = this.dlqMessages.get(queueName) || [];
    const messageIndex = messages.findIndex((m) => m.id === messageId);

    if (messageIndex === -1) {
      this.logger.warn(`DLQ message not found: ${messageId}`);
      return false;
    }

    const message = messages[messageIndex];

    try {
      const correlationId = this.correlationIdService.getCorrelationId();
      this.logger.log(
        `[${correlationId}] Retrying DLQ message: ${messageId} (${message.functionName})`,
      );

      await retryFn(message.data);

      // Remove from DLQ on success
      messages.splice(messageIndex, 1);
      this.logger.log(`DLQ message successfully retried and removed: ${messageId}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Retry failed for DLQ message ${messageId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }

  /**
   * Clean up old DLQ messages
   */
  cleanupOldMessages(queueName?: string): number {
    let totalRemoved = 0;

    const queues = queueName
      ? [queueName]
      : Array.from(this.dlqMessages.keys());

    for (const queue of queues) {
      const config = this.dlqConfigs.get(queue);
      if (!config) continue;

      const messages = this.dlqMessages.get(queue) || [];
      const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - retentionMs;

      const filtered = messages.filter((m) => m.failedAt.getTime() > cutoffTime);
      const removed = messages.length - filtered.length;

      this.dlqMessages.set(queue, filtered);
      totalRemoved += removed;

      if (removed > 0) {
        this.logger.log(`Cleaned up ${removed} old DLQ messages from ${queue}`);
      }
    }

    return totalRemoved;
  }

  /**
   * Subscribe to DLQ messages for a queue
   */
  onDLQMessage(
    queueName: string,
    callback: (message: DeadLetterMessage) => void,
  ): () => void {
    const callbacks = this.dlqCallbacks.get(queueName) || new Set();
    callbacks.add(callback);
    this.dlqCallbacks.set(queueName, callbacks);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
    };
  }

  /**
   * Clear all DLQ messages for a queue
   */
  clearDLQ(queueName: string): number {
    const messages = this.dlqMessages.get(queueName) || [];
    const count = messages.length;
    this.dlqMessages.set(queueName, []);
    this.logger.log(`Cleared ${count} messages from DLQ: ${queueName}`);
    return count;
  }

  /**
   * Clear all DLQ messages across all queues
   */
  clearAllDLQ(): number {
    let totalCleared = 0;

    for (const [queueName, messages] of this.dlqMessages.entries()) {
      totalCleared += messages.length;
      this.dlqMessages.set(queueName, []);
    }

    this.logger.log(`Cleared ${totalCleared} messages from all DLQs`);
    return totalCleared;
  }

  /**
   * Group errors by code
   */
  private groupErrorsByCode(messages: DeadLetterMessage[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const message of messages) {
      const code = message.error.code;
      grouped[code] = (grouped[code] || 0) + 1;
    }

    return grouped;
  }

  /**
   * Trigger callbacks for DLQ message
   */
  private triggerCallbacks(queueName: string, message: DeadLetterMessage): void {
    const callbacks = this.dlqCallbacks.get(queueName);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(message);
        } catch (error) {
          this.logger.error(`Error in DLQ callback: ${
            error instanceof Error ? error.message : error
          }`);
        }
      }
    }
  }

  /**
   * Generate unique DLQ message ID
   */
  private generateDLQMessageId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
