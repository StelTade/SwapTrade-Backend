// src/queue/message-deduplication.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import {
  DeduplicationEntry,
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

/**
 * Message Deduplication Service
 * Prevents duplicate message processing within a configurable time window
 */
@Injectable()
export class MessageDeduplicationService {
  private readonly logger = new Logger(MessageDeduplicationService.name);
  private config: HorizontalScalingConfig;
  private deduplicationCache: Map<string, DeduplicationEntry> = new Map();
  private messageFingerprints: Map<string, string> = new Map();

  constructor(private eventEmitter: EventEmitter2) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Message Deduplication Service initialized');
  }

  /**
   * Check if a message is duplicate
   */
  isDuplicate(messageId: string, messageData: any): boolean {
    if (!this.config.deduplication.enabled) {
      return false;
    }

    // Generate fingerprint from message data
    const fingerprint = this.generateFingerprint(messageData);

    // Check if we've seen this fingerprint before
    const existingFingerprint = this.messageFingerprints.get(messageId);
    if (existingFingerprint && existingFingerprint === fingerprint) {
      this.logger.debug(`Duplicate message detected: ${messageId}`);
      this.eventEmitter.emit('message.duplicate-detected', {
        messageId,
        fingerprint,
      });
      return true;
    }

    // Check if fingerprint exists for a different message ID
    for (const [existingId, existingFp] of this.messageFingerprints.entries()) {
      if (existingFp === fingerprint && existingId !== messageId) {
        this.logger.debug(
          `Duplicate fingerprint detected: ${messageId} matches ${existingId}`,
        );
        this.eventEmitter.emit('message.duplicate-detected', {
          messageId,
          duplicateOf: existingId,
          fingerprint,
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Register a message for deduplication tracking
   */
  registerMessage(messageId: string, messageData: any): void {
    if (!this.config.deduplication.enabled) {
      return;
    }

    const fingerprint = this.generateFingerprint(messageData);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.deduplication.windowMs,
    );

    const entry: DeduplicationEntry = {
      messageId,
      fingerprint,
      timestamp: now,
      expiresAt,
    };

    this.deduplicationCache.set(messageId, entry);
    this.messageFingerprints.set(messageId, fingerprint);

    // Check if we've exceeded max entries
    if (
      this.deduplicationCache.size >
      this.config.deduplication.maxDeduplicationEntries
    ) {
      this.cleanupOldestEntries();
    }

    this.logger.debug(`Message registered for deduplication: ${messageId}`);
  }

  /**
   * Unregister a message (after successful processing)
   */
  unregisterMessage(messageId: string): void {
    this.deduplicationCache.delete(messageId);
    this.messageFingerprints.delete(messageId);
    this.logger.debug(`Message unregistered from deduplication: ${messageId}`);
  }

  /**
   * Generate fingerprint from message data
   */
  private generateFingerprint(data: any): string {
    // Normalize data to ensure consistent hashing
    const normalizedData = this.normalizeData(data);
    const dataString = JSON.stringify(normalizedData);

    // Create SHA-256 hash
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Normalize data for consistent fingerprinting
   */
  private normalizeData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.normalizeData(item));
    }

    // Sort object keys for consistent ordering
    const sortedKeys = Object.keys(data).sort();
    const normalized: Record<string, any> = {};

    for (const key of sortedKeys) {
      normalized[key] = this.normalizeData(data[key]);
    }

    return normalized;
  }

  /**
   * Check if message ID exists in cache
   */
  hasMessage(messageId: string): boolean {
    return this.deduplicationCache.has(messageId);
  }

  /**
   * Get deduplication entry for a message
   */
  getEntry(messageId: string): DeduplicationEntry | undefined {
    return this.deduplicationCache.get(messageId);
  }

  /**
   * Get all tracked messages
   */
  getAllEntries(): DeduplicationEntry[] {
    return Array.from(this.deduplicationCache.values());
  }

  /**
   * Get count of tracked messages
   */
  getTrackedCount(): number {
    return this.deduplicationCache.size;
  }

  /**
   * Clean up expired entries
   */
  @Cron(CronExpression.EVERY_MINUTE)
  cleanupExpiredEntries(): void {
    if (!this.config.deduplication.enabled) {
      return;
    }

    const now = new Date();
    let cleanedCount = 0;

    for (const [messageId, entry] of this.deduplicationCache.entries()) {
      if (entry.expiresAt <= now) {
        this.deduplicationCache.delete(messageId);
        this.messageFingerprints.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(
        `Cleaned up ${cleanedCount} expired deduplication entries`,
      );
    }
  }

  /**
   * Clean up oldest entries when cache is full
   */
  private cleanupOldestEntries(): void {
    const entries = Array.from(this.deduplicationCache.entries());

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

    // Remove oldest 10% of entries
    const removeCount = Math.ceil(entries.length * 0.1);

    for (let i = 0; i < removeCount; i++) {
      const [messageId] = entries[i];
      this.deduplicationCache.delete(messageId);
      this.messageFingerprints.delete(messageId);
    }

    this.logger.debug(
      `Cleaned up ${removeCount} oldest deduplication entries (cache full)`,
    );
  }

  /**
   * Clear all deduplication data
   */
  clearAll(): void {
    this.deduplicationCache.clear();
    this.messageFingerprints.clear();
    this.logger.log('All deduplication data cleared');
  }

  /**
   * Get deduplication statistics
   */
  getStats(): {
    enabled: boolean;
    trackedMessages: number;
    maxEntries: number;
    windowMs: number;
    cacheUtilizationPercent: number;
  } {
    return {
      enabled: this.config.deduplication.enabled,
      trackedMessages: this.deduplicationCache.size,
      maxEntries: this.config.deduplication.maxDeduplicationEntries,
      windowMs: this.config.deduplication.windowMs,
      cacheUtilizationPercent:
        (this.deduplicationCache.size /
          this.config.deduplication.maxDeduplicationEntries) *
        100,
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
    this.logger.log('Deduplication configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}
