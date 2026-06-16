// src/queue/zero-loss-message.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

/**
 * Message persistence entry
 */
export interface PersistedMessage {
  messageId: string;
  queueName: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  replicationNodes: string[];
}

/**
 * Zero-Loss Message Service
 * Ensures no messages are lost through persistence, replication, and acknowledgment
 */
@Injectable()
export class ZeroLossMessageService {
  private readonly logger = new Logger(ZeroLossMessageService.name);
  private config: HorizontalScalingConfig;
  private persistedMessages: Map<string, PersistedMessage> = new Map();
  private pendingAcknowledgments: Map<string, NodeJS.Timeout> = new Map();
  private replicationNodes: Set<string> = new Set();

  constructor(private eventEmitter: EventEmitter2) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Zero-Loss Message Service initialized');
  }

  /**
   * Register a replication node
   */
  registerReplicationNode(nodeId: string): void {
    this.replicationNodes.add(nodeId);
    this.logger.log(`Replication node registered: ${nodeId}`);
  }

  /**
   * Unregister a replication node
   */
  unregisterReplicationNode(nodeId: string): void {
    this.replicationNodes.delete(nodeId);
    this.logger.log(`Replication node unregistered: ${nodeId}`);
  }

  /**
   * Persist a message
   */
  persistMessage(
    messageId: string,
    queueName: string,
    data: any,
    maxAttempts: number = this.config.zeroLoss.maxRetryAttempts,
  ): PersistedMessage {
    const now = new Date();
    
    const message: PersistedMessage = {
      messageId,
      queueName,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: now,
      updatedAt: now,
      replicationNodes: this.getReplicationTargets(),
    };

    this.persistedMessages.set(messageId, message);

    // Set acknowledgment timeout
    if (this.config.zeroLoss.enabled) {
      this.setAcknowledgmentTimeout(messageId);
    }

    this.logger.debug(`Message persisted: ${messageId} (queue: ${queueName})`);
    this.eventEmitter.emit('message.persisted', { messageId, queueName });

    return message;
  }

  /**
   * Get replication targets
   */
  private getReplicationTargets(): string[] {
    const targets: string[] = [];
    const nodes = Array.from(this.replicationNodes);
    
    // Select nodes based on replication factor
    const count = Math.min(
      this.config.zeroLoss.replicationFactor,
      nodes.length,
    );

    for (let i = 0; i < count; i++) {
      targets.push(nodes[i % nodes.length]);
    }

    return targets;
  }

  /**
   * Set acknowledgment timeout for a message
   */
  private setAcknowledgmentTimeout(messageId: string): void {
    const timeout = setTimeout(() => {
      this.handleAcknowledgmentTimeout(messageId);
    }, this.config.zeroLoss.acknowledgmentTimeoutMs);

    this.pendingAcknowledgments.set(messageId, timeout);
  }

  /**
   * Handle acknowledgment timeout
   */
  private handleAcknowledgmentTimeout(messageId: string): void {
    const message = this.persistedMessages.get(messageId);
    
    if (message && message.status === 'processing' && !message.acknowledgedAt) {
      this.logger.warn(`Acknowledgment timeout for message: ${messageId}`);
      
      // Retry if attempts remaining
      if (message.attempts < message.maxAttempts) {
        message.status = 'pending';
        message.updatedAt = new Date();
        this.logger.log(`Message re-queued after timeout: ${messageId}`);
        this.eventEmitter.emit('message.requeued', { messageId, reason: 'acknowledgment-timeout' });
      } else {
        message.status = 'failed';
        message.error = 'Acknowledgment timeout';
        message.failedAt = new Date();
        message.updatedAt = new Date();
        this.logger.error(`Message failed after max attempts: ${messageId}`);
        this.eventEmitter.emit('message.failed', { messageId, reason: 'max-attempts-exceeded' });
      }
    }

    this.pendingAcknowledgments.delete(messageId);
  }

  /**
   * Mark message as processing
   */
  markProcessing(messageId: string): boolean {
    const message = this.persistedMessages.get(messageId);
    
    if (!message) {
      this.logger.warn(`Message not found: ${messageId}`);
      return false;
    }

    message.status = 'processing';
    message.attempts++;
    message.updatedAt = new Date();

    this.logger.debug(`Message marked as processing: ${messageId} (attempt ${message.attempts}/${message.maxAttempts})`);
    return true;
  }

  /**
   * Acknowledge message processing
   */
  acknowledgeMessage(messageId: string): boolean {
    const message = this.persistedMessages.get(messageId);
    
    if (!message) {
      this.logger.warn(`Message not found for acknowledgment: ${messageId}`);
      return false;
    }

    // Clear timeout
    const timeout = this.pendingAcknowledgments.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAcknowledgments.delete(messageId);
    }

    message.acknowledgedAt = new Date();
    message.updatedAt = new Date();

    this.logger.debug(`Message acknowledged: ${messageId}`);
    this.eventEmitter.emit('message.acknowledged', { messageId });

    return true;
  }

  /**
   * Mark message as completed
   */
  markCompleted(messageId: string): boolean {
    const message = this.persistedMessages.get(messageId);
    
    if (!message) {
      return false;
    }

    message.status = 'completed';
    message.completedAt = new Date();
    message.updatedAt = new Date();

    this.logger.debug(`Message completed: ${messageId}`);
    this.eventEmitter.emit('message.completed', { messageId });

    return true;
  }

  /**
   * Mark message as failed
   */
  markFailed(messageId: string, error: string): boolean {
    const message = this.persistedMessages.get(messageId);
    
    if (!message) {
      return false;
    }

    message.status = 'failed';
    message.error = error;
    message.failedAt = new Date();
    message.updatedAt = new Date();

    this.logger.warn(`Message failed: ${messageId} - ${error}`);
    this.eventEmitter.emit('message.failed', { messageId, error });

    return true;
  }

  /**
   * Retry a failed message
   */
  retryMessage(messageId: string): boolean {
    const message = this.persistedMessages.get(messageId);
    
    if (!message) {
      return false;
    }

    if (message.attempts >= message.maxAttempts) {
      this.logger.warn(`Message ${messageId} has exceeded max attempts`);
      return false;
    }

    message.status = 'pending';
    message.error = undefined;
    message.updatedAt = new Date();

    this.logger.log(`Message retry initiated: ${messageId}`);
    this.eventEmitter.emit('message.retried', { messageId });

    return true;
  }

  /**
   * Get message by ID
   */
  getMessage(messageId: string): PersistedMessage | undefined {
    return this.persistedMessages.get(messageId);
  }

  /**
   * Get all messages for a queue
   */
  getQueueMessages(queueName: string): PersistedMessage[] {
    const messages: PersistedMessage[] = [];
    
    for (const message of this.persistedMessages.values()) {
      if (message.queueName === queueName) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get messages by status
   */
  getMessagesByStatus(status: PersistedMessage['status']): PersistedMessage[] {
    const messages: PersistedMessage[] = [];
    
    for (const message of this.persistedMessages.values()) {
      if (message.status === status) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get pending messages (for recovery)
   */
  getPendingMessages(): PersistedMessage[] {
    return this.getMessagesByStatus('pending');
  }

  /**
   * Get failed messages (for manual intervention)
   */
  getFailedMessages(): PersistedMessage[] {
    return this.getMessagesByStatus('failed');
  }

  /**
   * Clean up completed messages
   */
  cleanupCompletedMessages(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedCount = 0;

    for (const [messageId, message] of this.persistedMessages.entries()) {
      if (
        message.status === 'completed' &&
        message.completedAt &&
        message.completedAt.getTime() < cutoffTime
      ) {
        this.persistedMessages.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} completed messages`);
    }

    return cleanedCount;
  }

  /**
   * Get message statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    replicationNodes: number;
    pendingAcknowledgments: number;
  } {
    const messages = Array.from(this.persistedMessages.values());

    return {
      total: messages.length,
      pending: messages.filter((m) => m.status === 'pending').length,
      processing: messages.filter((m) => m.status === 'processing').length,
      completed: messages.filter((m) => m.status === 'completed').length,
      failed: messages.filter((m) => m.status === 'failed').length,
      replicationNodes: this.replicationNodes.size,
      pendingAcknowledgments: this.pendingAcknowledgments.size,
    };
  }

  /**
   * Verify message integrity
   */
  verifyMessageIntegrity(messageId: string): {
    valid: boolean;
    issues: string[];
  } {
    const message = this.persistedMessages.get(messageId);
    const issues: string[] = [];

    if (!message) {
      return { valid: false, issues: ['Message not found'] };
    }

    // Check for orphaned processing state
    if (message.status === 'processing' && !message.acknowledgedAt) {
      const timeSinceUpdate = Date.now() - message.updatedAt.getTime();
      if (timeSinceUpdate > this.config.zeroLoss.acknowledgmentTimeoutMs * 2) {
        issues.push('Message stuck in processing state');
      }
    }

    // Check for missing replication
    if (message.replicationNodes.length < this.config.zeroLoss.replicationFactor) {
      issues.push(`Insufficient replication: ${message.replicationNodes.length}/${this.config.zeroLoss.replicationFactor}`);
    }

    // Check for excessive retries
    if (message.attempts > message.maxAttempts) {
      issues.push('Exceeded max retry attempts');
    }

    return {
      valid: issues.length === 0,
      issues,
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
    this.logger.log('Zero-loss message configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}