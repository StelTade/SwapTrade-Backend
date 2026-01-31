// src/queue/queue.config.ts
import type { JobOptions } from 'bull';

/**
 * Retry policies for different job types
 * Defines exponential backoff strategies and max attempts
 */
export enum RetryPolicy {
  CRITICAL = 'CRITICAL', // Max retries: 5, aggressive backoff
  HIGH = 'HIGH', // Max retries: 4, standard backoff
  NORMAL = 'NORMAL', // Max retries: 3, moderate backoff
  LOW = 'LOW', // Max retries: 1, minimal backoff
}

export interface RetryPolicyConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitterFactor: number; // 0.0-1.0 for random delay variation
}

/**
 * Retry policy configurations for exponential backoff
 */
export const RETRY_POLICIES: Record<RetryPolicy, RetryPolicyConfig> = {
  [RetryPolicy.CRITICAL]: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  [RetryPolicy.HIGH]: {
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 45000,
    backoffMultiplier: 1.8,
    jitterFactor: 0.15,
  },
  [RetryPolicy.NORMAL]: {
    maxAttempts: 3,
    baseDelay: 5000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.2,
  },
  [RetryPolicy.LOW]: {
    maxAttempts: 1,
    baseDelay: 10000,
    maxDelay: 10000,
    backoffMultiplier: 1,
    jitterFactor: 0.0,
  },
};

/**
 * Calculate exponential backoff delay with jitter
 * Formula: baseDelay * (backoffMultiplier ^ attemptNumber) + random jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicyConfig,
): number {
  // Calculate exponential backoff
  const exponentialDelay =
    policy.baseDelay * Math.pow(policy.backoffMultiplier, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelay);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * policy.jitterFactor * Math.random();
  return Math.floor(cappedDelay + jitter);
}

/**
 * Get job options for a specific retry policy
 */
export function getJobOptionsForPolicy(
  policy: RetryPolicy,
  additionalOptions?: Partial<JobOptions>,
): JobOptions {
  const policyConfig = RETRY_POLICIES[policy];

  return {
    attempts: policyConfig.maxAttempts,
    backoff: {
      type: 'custom',
    },
    // Delay calculated dynamically in exponential backoff
    ...additionalOptions,
  };
}

/**
 * Job type classifications for routing to different queues
 */
export enum JobClassification {
  CRITICAL = 'CRITICAL', // e.g., payment confirmations
  HIGH = 'HIGH', // e.g., trade notifications
  NORMAL = 'NORMAL', // e.g., regular email
  LOW = 'LOW', // e.g., cleanup tasks
}

/**
 * Map job classification to retry policy
 */
export const CLASSIFICATION_TO_POLICY: Record<JobClassification, RetryPolicy> =
  {
    [JobClassification.CRITICAL]: RetryPolicy.CRITICAL,
    [JobClassification.HIGH]: RetryPolicy.HIGH,
    [JobClassification.NORMAL]: RetryPolicy.NORMAL,
    [JobClassification.LOW]: RetryPolicy.LOW,
  };

/**
 * Dead Letter Queue configuration
 */
export interface DLQConfig {
  enabled: boolean;
  maxAge: number; // milliseconds to retain DLQ items
  notifyOnFailure: boolean; // Send admin notification on permanent failure
  alertThreshold: number; // Alert if DLQ count exceeds this
}

export const DEFAULT_DLQ_CONFIG: DLQConfig = {
  enabled: true,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  notifyOnFailure: true,
  alertThreshold: 100,
};

/**
 * Queue health check thresholds
 */
export interface QueueHealthThresholds {
  warningWaitingCount: number;
  criticalWaitingCount: number;
  warningFailureRate: number; // percentage
  criticalFailureRate: number; // percentage
  maxProcessingTimeMs: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: QueueHealthThresholds = {
  warningWaitingCount: 1000,
  criticalWaitingCount: 5000,
  warningFailureRate: 5,
  criticalFailureRate: 10,
  maxProcessingTimeMs: 300000, // 5 minutes
};
