import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

interface QueuedMessage {
  id: string;
  room: string;
  event: string;
  data: any;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

interface QueueStats {
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  averageProcessingTime: number;
  queueSize: number;
  messagesByPriority: Record<string, number>;
}

@Injectable()
export class MessageQueueService extends EventEmitter {
  private readonly logger = new Logger(MessageQueueService.name);
  private messageQueue: QueuedMessage[] = [];
  private readonly processing = new Set<string>();
  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly BATCH_SIZE = 100;
  private readonly PROCESSING_INTERVAL = 10; // ms
  private readonly RETRY_DELAY = 1000; // ms

  private stats: QueueStats = {
    totalMessages: 0,
    processedMessages: 0,
    failedMessages: 0,
    averageProcessingTime: 0,
    queueSize: 0,
    messagesByPriority: { high: 0, medium: 0, low: 0 },
  };

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Queue message with priority
   */
  queueMessage(
    room: string,
    event: string,
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium',
  ): string {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      this.logger.warn('Message queue is full, dropping low priority messages');
      this.dropLowPriorityMessages();
    }

    const message: QueuedMessage = {
      id: this.generateMessageId(),
      room,
      event,
      data,
      priority,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: priority === 'high' ? 3 : 2,
    };

    this.insertMessageByPriority(message);
    this.updateStats();

    this.logger.debug(`Message queued: ${message.id} (${priority} priority)`);
    return message.id;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.messageQueue.length = 0;
    this.processing.clear();
    this.stats = {
      totalMessages: 0,
      processedMessages: 0,
      failedMessages: 0,
      averageProcessingTime: 0,
      queueSize: 0,
      messagesByPriority: { high: 0, medium: 0, low: 0 },
    };
    this.logger.log('Message queue cleared');
  }

  /**
   * Start message processing loop
   */
  private startProcessing(): void {
    setInterval(() => {
      this.processBatch();
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Process batch of messages
   */
  private async processBatch(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    const batch = this.messageQueue.splice(0, this.BATCH_SIZE);
    const processingPromises: Promise<void>[] = [];

    for (const message of batch) {
      if (this.processing.has(message.id)) continue;

      this.processing.add(message.id);
      processingPromises.push(this.processMessage(message));
    }

    try {
      await Promise.allSettled(processingPromises);
    } catch (error) {
      this.logger.error('Error processing message batch:', error);
    }
  }

  /**
   * Process individual message
   */
  private async processMessage(message: QueuedMessage): Promise<void> {
    const startTime = Date.now();

    try {
      // Emit message for broadcasting
      this.emit('processMessage', message);

      // Mark as processed
      this.processing.delete(message.id);
      this.stats.processedMessages++;

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      this.logger.debug(
        `Message processed: ${message.id} in ${processingTime}ms`,
      );
    } catch (error) {
      this.processing.delete(message.id);
      message.retryCount++;

      if (message.retryCount < message.maxRetries) {
        // Retry after delay
        setTimeout(() => {
          this.insertMessageByPriority(message);
          this.logger.warn(
            `Retrying message: ${message.id} (attempt ${message.retryCount})`,
          );
        }, this.RETRY_DELAY);
      } else {
        this.stats.failedMessages++;
        this.logger.error(
          `Message failed after ${message.retryCount} retries: ${message.id}`,
          error,
        );
      }
    }
  }

  /**
   * Insert message maintaining priority order
   */
  private insertMessageByPriority(message: QueuedMessage): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const messagePriority = priorityOrder[message.priority];

    let insertIndex = this.messageQueue.length;
    for (let i = 0; i < this.messageQueue.length; i++) {
      const existingPriority = priorityOrder[this.messageQueue[i].priority];
      if (messagePriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.messageQueue.splice(insertIndex, 0, message);
    this.stats.totalMessages++;
  }

  /**
   * Drop low priority messages when queue is full
   */
  private dropLowPriorityMessages(): void {
    const originalLength = this.messageQueue.length;

    // Remove low priority messages from the end
    for (let i = this.messageQueue.length - 1; i >= 0; i--) {
      if (this.messageQueue[i].priority === 'low') {
        this.messageQueue.splice(i, 1);
        this.stats.failedMessages++;
      }
    }

    const droppedCount = originalLength - this.messageQueue.length;
    if (droppedCount > 0) {
      this.logger.warn(`Dropped ${droppedCount} low priority messages`);
    }
  }

  /**
   * Update queue statistics
   */
  private updateStats(): void {
    this.stats.queueSize = this.messageQueue.length;

    // Count by priority
    this.stats.messagesByPriority = { high: 0, medium: 0, low: 0 };
    this.messageQueue.forEach((message) => {
      this.stats.messagesByPriority[message.priority]++;
    });
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    if (this.stats.processedMessages === 1) {
      this.stats.averageProcessingTime = processingTime;
    } else {
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.processedMessages - 1) +
          processingTime) /
        this.stats.processedMessages;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get messages for specific room
   */
  getMessagesForRoom(room: string, limit: number = 100): QueuedMessage[] {
    return this.messageQueue.filter((msg) => msg.room === room).slice(0, limit);
  }

  /**
   * Remove messages for room
   */
  removeMessagesForRoom(room: string): number {
    const originalLength = this.messageQueue.length;
    this.messageQueue = this.messageQueue.filter((msg) => msg.room !== room);
    return originalLength - this.messageQueue.length;
  }
}
