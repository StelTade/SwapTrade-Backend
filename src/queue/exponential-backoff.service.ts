// src/queue/exponential-backoff.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  calculateBackoffDelay,
  RETRY_POLICIES,
  RetryPolicy,
  RetryPolicyConfig,
} from './queue.config';

export interface BackoffResult {
  shouldRetry: boolean;
  nextRetryTime?: Date;
  delay: number;
  attempt: number;
  maxAttempts: number;
}

/**
 * Service for managing exponential backoff strategies for job retries
 * Implements exponential backoff with jitter to prevent thundering herd
 */
@Injectable()
export class ExponentialBackoffService {
  private readonly logger = new Logger(ExponentialBackoffService.name);
  private readonly retryAttemptTimestamps = new Map<string, number[]>();

  /**
   * Calculate the next retry delay for a job using exponential backoff
   */
  calculateRetryDelay(job: Job, policy: RetryPolicy): BackoffResult {
    const policyConfig = RETRY_POLICIES[policy];
    const attempt = job.attemptsMade || 0;
    const hasRetriesLeft =
      attempt < policyConfig.maxAttempts;

    if (!hasRetriesLeft) {
      this.logger.warn(
        `Job ${job.id} has exhausted all retries (${attempt}/${policyConfig.maxAttempts})`,
      );
      return {
        shouldRetry: false,
        attempt,
        maxAttempts: policyConfig.maxAttempts,
        delay: 0,
      };
    }

    const delay = calculateBackoffDelay(attempt, policyConfig);
    const nextRetryTime = new Date(Date.now() + delay);

    this.logger.debug(
      `Job ${job.id}: Scheduling retry ${attempt + 1}/${policyConfig.maxAttempts} ` +
        `in ${delay}ms at ${nextRetryTime.toISOString()}`,
    );

    return {
      shouldRetry: true,
      nextRetryTime,
      delay,
      attempt,
      maxAttempts: policyConfig.maxAttempts,
    };
  }

  /**
   * Track retry attempts for analytics
   */
  trackRetryAttempt(jobId: string): void {
    const attempts = this.retryAttemptTimestamps.get(jobId) || [];
    attempts.push(Date.now());
    this.retryAttemptTimestamps.set(jobId, attempts);
  }

  /**
   * Get retry history for a job
   */
  getRetryHistory(jobId: string): Date[] {
    const timestamps = this.retryAttemptTimestamps.get(jobId) || [];
    return timestamps.map((ts) => new Date(ts));
  }

  /**
   * Clear retry history for a job (after completion or permanent failure)
   */
  clearRetryHistory(jobId: string): void {
    this.retryAttemptTimestamps.delete(jobId);
  }

  /**
   * Get policy configuration
   */
  getPolicy(policy: RetryPolicy): RetryPolicyConfig {
    return RETRY_POLICIES[policy];
  }

  /**
   * Get all available policies
   */
  getAllPolicies(): Record<RetryPolicy, RetryPolicyConfig> {
    return RETRY_POLICIES;
  }

  /**
   * Check if retry should happen based on error type
   * Some errors are not retryable
   */
  isRetryableError(error: Error | string): boolean {
    const errorStr =
      typeof error === 'string' ? error : error?.message || '';

    // Non-retryable error patterns
    const nonRetryablePatterns = [
      'validation',
      'invalid',
      'not found',
      '404',
      'forbidden',
      '403',
      'unauthorized',
      '401',
    ];

    const lowerError = errorStr.toLowerCase();
    return !nonRetryablePatterns.some((pattern) => lowerError.includes(pattern));
  }

  /**
   * Get recommended retry policy based on error
   */
  getRecommendedPolicy(error: Error | string): RetryPolicy {
    const errorStr =
      typeof error === 'string' ? error : error?.message || '';
    const lowerError = errorStr.toLowerCase();

    // Critical errors that need more retries
    if (
      lowerError.includes('timeout') ||
      lowerError.includes('connection') ||
      lowerError.includes('network')
    ) {
      return RetryPolicy.CRITICAL;
    }

    // High priority errors
    if (
      lowerError.includes('temporarily') ||
      lowerError.includes('throttle') ||
      lowerError.includes('rate limit')
    ) {
      return RetryPolicy.HIGH;
    }

    // Default to normal
    return RetryPolicy.NORMAL;
  }
}
