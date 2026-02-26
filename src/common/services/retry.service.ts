import { Injectable, Logger } from '@nestjs/common';
import { ErrorCategorizer } from '../exceptions/error-categorizer';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitterFactor: number;
  backoffType: 'exponential' | 'linear';
  timeoutMs?: number;
}

/**
 * Retry result containing execution history
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
  lastError?: Error;
  errors: Error[];
}

/**
 * Service for handling retries with exponential backoff and jitter
 * Automatically categorizes errors and applies appropriate retry strategies
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  // Default retry policies for different scenarios
  private readonly defaultPolicies = {
    aggressive: {
      maxRetries: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      multiplier: 2,
      jitterFactor: 0.1,
      backoffType: 'exponential' as const,
    },
    moderate: {
      maxRetries: 3,
      initialDelayMs: 500,
      maxDelayMs: 30000,
      multiplier: 2,
      jitterFactor: 0.2,
      backoffType: 'exponential' as const,
    },
    conservative: {
      maxRetries: 2,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterFactor: 0.3,
      backoffType: 'exponential' as const,
    },
  };

  constructor(private readonly correlationIdService: CorrelationIdService) {}

  /**
   * Execute function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    policyName: keyof typeof this.defaultPolicies = 'moderate',
    functionName?: string,
  ): Promise<RetryResult<T>> {
    const policy = this.defaultPolicies[policyName];
    return this.retryWithPolicy(fn, policy, functionName || fn.name);
  }

  /**
   * Execute function with custom retry policy
   */
  async retryWithPolicy<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy,
    functionName: string = 'anonymous',
  ): Promise<RetryResult<T>> {
    const correlationId = this.correlationIdService.getCorrelationId();
    const startTime = Date.now();
    const errors: Error[] = [];
    let lastError: Error | undefined;
    let attempts = 0;

    for (attempts = 1; attempts <= policy.maxRetries + 1; attempts++) {
      try {
        this.logger.debug(
          `[${correlationId}] Executing ${functionName} (attempt ${attempts}/${policy.maxRetries + 1})`,
        );

        const result = await this.executeWithTimeout(fn, policy.timeoutMs);

        const totalTimeMs = Date.now() - startTime;
        this.logger.debug(
          `[${correlationId}] ${functionName} succeeded after ${totalTimeMs}ms (${attempts} attempts)`,
        );

        return {
          success: true,
          result,
          attempts,
          totalTimeMs,
          errors,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        errors.push(lastError);

        const shouldRetry = attempts <= policy.maxRetries && this.shouldRetry(error);

        this.logger.warn(
          `[${correlationId}] ${functionName} failed on attempt ${attempts}: ${lastError.message} (retryable: ${shouldRetry})`,
        );

        if (!shouldRetry) {
          const totalTimeMs = Date.now() - startTime;
          return {
            success: false,
            error: lastError,
            attempts,
            totalTimeMs,
            lastError,
            errors,
          };
        }

        if (attempts <= policy.maxRetries) {
          const delayMs = this.calculateBackoff(attempts, policy);
          this.logger.debug(
            `[${correlationId}] Retrying ${functionName} after ${delayMs}ms`,
          );
          await this.delay(delayMs);
        }
      }
    }

    const totalTimeMs = Date.now() - startTime;
    return {
      success: false,
      error: lastError,
      attempts,
      totalTimeMs,
      lastError,
      errors,
    };
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: any): boolean {
    return ErrorCategorizer.isRetryable(error);
  }

  /**
   * Calculate backoff delay with exponential growth and jitter
   */
  private calculateBackoff(attemptNumber: number, policy: RetryPolicy): number {
    let delay: number;

    if (policy.backoffType === 'exponential') {
      delay = policy.initialDelayMs * Math.pow(policy.multiplier, attemptNumber - 1);
    } else {
      delay = policy.initialDelayMs * attemptNumber;
    }

    // Cap at max delay
    delay = Math.min(delay, policy.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = delay * policy.jitterFactor * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);

    return Math.round(delay);
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs) {
      return fn();
    }

    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Delay utility function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get retry policy by name
   */
  getPolicy(
    policyName: keyof typeof this.defaultPolicies,
  ): RetryPolicy {
    return this.defaultPolicies[policyName];
  }

  /**
   * Create custom retry policy
   */
  createCustomPolicy(
    maxRetries: number,
    initialDelayMs: number,
    maxDelayMs: number,
    multiplier: number = 2,
    jitterFactor: number = 0.1,
    backoffType: 'exponential' | 'linear' = 'exponential',
  ): RetryPolicy {
    return {
      maxRetries,
      initialDelayMs,
      maxDelayMs,
      multiplier,
      jitterFactor,
      backoffType,
    };
  }
}
