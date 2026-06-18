// src/queue/message-ordering.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MessageOrderingPartition,
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

/**
 * Message Ordering Service
 * Ensures messages are processed in order based on partition keys
 */
@Injectable()
export class MessageOrderingService {
  private readonly logger = new Logger(MessageOrderingService.name);
  private config: HorizontalScalingConfig;
  private partitions: Map<string, MessageOrderingPartition> = new Map();
  private sequenceNumbers: Map<string, number> = new Map();

  constructor(private eventEmitter: EventEmitter2) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Message Ordering Service initialized');
  }

  /**
   * Add message to ordered partition
   */
  addMessage(
    queueName: string,
    partitionKey: string,
    messageId: string,
    data: any,
  ): { partitionKey: string; sequenceNumber: number } {
    if (!this.config.ordering.enabled) {
      return { partitionKey, sequenceNumber: 0 };
    }

    const partitionId = this.getPartitionId(queueName, partitionKey);

    // Get or create partition
    if (!this.partitions.has(partitionId)) {
      this.partitions.set(partitionId, {
        partitionKey,
        queueName,
        messages: [],
        isProcessing: false,
      });
      this.sequenceNumbers.set(partitionId, 0);
    }

    const partition = this.partitions.get(partitionId)!;
    const sequenceNumber = this.incrementSequence(partitionId);

    // Add message to partition
    partition.messages.push({
      messageId,
      data,
      timestamp: new Date(),
      sequenceNumber,
    });

    // Sort messages by sequence number
    partition.messages.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    this.logger.debug(
      `Message added to partition ${partitionId}: ${messageId} (seq: ${sequenceNumber})`,
    );

    return { partitionKey, sequenceNumber };
  }

  /**
   * Get next message from partition (in order)
   */
  getNextMessage(
    queueName: string,
    partitionKey: string,
  ): { messageId: string; data: any; sequenceNumber: number } | null {
    if (!this.config.ordering.enabled) {
      return null;
    }

    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);

    if (!partition || partition.messages.length === 0) {
      return null;
    }

    // Check if partition is already being processed
    if (partition.isProcessing) {
      return null;
    }

    // Get next message (lowest sequence number)
    const nextMessage = partition.messages[0];

    return {
      messageId: nextMessage.messageId,
      data: nextMessage.data,
      sequenceNumber: nextMessage.sequenceNumber,
    };
  }

  /**
   * Mark partition as processing
   */
  markPartitionProcessing(
    queueName: string,
    partitionKey: string,
    isProcessing: boolean,
  ): void {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);

    if (partition) {
      partition.isProcessing = isProcessing;
      if (isProcessing) {
        partition.lastProcessedAt = new Date();
      }
    }
  }

  /**
   * Remove processed message from partition
   */
  removeMessage(
    queueName: string,
    partitionKey: string,
    messageId: string,
  ): boolean {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);

    if (!partition) {
      return false;
    }

    const index = partition.messages.findIndex(
      (m) => m.messageId === messageId,
    );
    if (index === -1) {
      return false;
    }

    partition.messages.splice(index, 1);
    this.logger.debug(
      `Message removed from partition ${partitionId}: ${messageId}`,
    );

    return true;
  }

  /**
   * Get partition ID from queue name and partition key
   */
  private getPartitionId(queueName: string, partitionKey: string): string {
    return `${queueName}:${partitionKey}`;
  }

  /**
   * Increment sequence number for a partition
   */
  private incrementSequence(partitionId: string): number {
    const current = this.sequenceNumbers.get(partitionId) || 0;
    const next = current + 1;
    this.sequenceNumbers.set(partitionId, next);
    return next;
  }

  /**
   * Get partition by ID
   */
  getPartition(
    queueName: string,
    partitionKey: string,
  ): MessageOrderingPartition | undefined {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    return this.partitions.get(partitionId);
  }

  /**
   * Get all partitions for a queue
   */
  getQueuePartitions(queueName: string): MessageOrderingPartition[] {
    const partitions: MessageOrderingPartition[] = [];

    for (const [partitionId, partition] of this.partitions.entries()) {
      if (partition.queueName === queueName) {
        partitions.push(partition);
      }
    }

    return partitions;
  }

  /**
   * Get all partitions
   */
  getAllPartitions(): MessageOrderingPartition[] {
    return Array.from(this.partitions.values());
  }

  /**
   * Get partition count for a queue
   */
  getPartitionCount(queueName: string): number {
    let count = 0;
    for (const partition of this.partitions.values()) {
      if (partition.queueName === queueName) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total message count across all partitions
   */
  getTotalMessageCount(): number {
    let total = 0;
    for (const partition of this.partitions.values()) {
      total += partition.messages.length;
    }
    return total;
  }

  /**
   * Get message count for a specific partition
   */
  getPartitionMessageCount(queueName: string, partitionKey: string): number {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);
    return partition ? partition.messages.length : 0;
  }

  /**
   * Clear all messages from a partition
   */
  clearPartition(queueName: string, partitionKey: string): boolean {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);

    if (!partition) {
      return false;
    }

    const messageCount = partition.messages.length;
    partition.messages = [];
    this.sequenceNumbers.set(partitionId, 0);

    this.logger.log(
      `Cleared ${messageCount} messages from partition ${partitionId}`,
    );
    return true;
  }

  /**
   * Remove empty partitions
   */
  cleanupEmptyPartitions(): number {
    let removedCount = 0;

    for (const [partitionId, partition] of this.partitions.entries()) {
      if (partition.messages.length === 0 && !partition.isProcessing) {
        this.partitions.delete(partitionId);
        this.sequenceNumbers.delete(partitionId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Cleaned up ${removedCount} empty partitions`);
    }

    return removedCount;
  }

  /**
   * Check if partition is processing
   */
  isPartitionProcessing(queueName: string, partitionKey: string): boolean {
    const partitionId = this.getPartitionId(queueName, partitionKey);
    const partition = this.partitions.get(partitionId);
    return partition ? partition.isProcessing : false;
  }

  /**
   * Get ordering statistics
   */
  getStats(): {
    enabled: boolean;
    totalPartitions: number;
    totalMessages: number;
    processingPartitions: number;
    averageMessagesPerPartition: number;
  } {
    const partitions = Array.from(this.partitions.values());
    const processingCount = partitions.filter((p) => p.isProcessing).length;
    const totalMessages = partitions.reduce(
      (sum, p) => sum + p.messages.length,
      0,
    );

    return {
      enabled: this.config.ordering.enabled,
      totalPartitions: partitions.length,
      totalMessages,
      processingPartitions: processingCount,
      averageMessagesPerPartition:
        partitions.length > 0 ? totalMessages / partitions.length : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Message ordering configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}
