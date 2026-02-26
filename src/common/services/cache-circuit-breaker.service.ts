import { Injectable, Logger } from '@nestjs/common';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening
  resetTimeout?: number; // Milliseconds before attempting recovery
  monitorInterval?: number; // Check interval for recovery
}

/**
 * Circuit breaker pattern implementation for cache failures
 * Prevents cascading failures and excessive cache operations
 */
@Injectable()
export class CacheCircuitBreaker {
  private readonly logger = new Logger(CacheCircuitBreaker.name);
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor() {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitorInterval: 10000, // 10 seconds
    };

    // Start monitoring for recovery
    this.startMonitoring();
  }

  /**
   * Check if circuit breaker allows operation
   */
  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      return true; // Allow one test request
    }

    return false; // OPEN state
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      // If enough successes, close the circuit
      if (this.successCount >= 2) {
        this.closeCircuit();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1); // Gradual recovery
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.logger.warn(
      `Cache operation failed. Failure count: ${this.failureCount}/${this.options.failureThreshold}`,
    );

    if (
      this.state === CircuitBreakerState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.openCircuit();
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.openCircuit();
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime)
        : null,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.logger.log('Circuit breaker reset');
  }

  /**
   * Private: Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitBreakerState.OPEN;
    this.logger.error(
      `Circuit breaker OPENED. Cache operations will be blocked for ${this.options.resetTimeout}ms`,
    );
  }

  /**
   * Private: Close the circuit
   */
  private closeCircuit(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.logger.log('Circuit breaker CLOSED. Cache operations resumed');
  }

  /**
   * Private: Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
    this.logger.log('Circuit breaker HALF-OPEN. Attempting recovery...');
  }

  /**
   * Private: Start monitoring for recovery
   */
  private startMonitoring(): void {
    setInterval(() => {
      if (this.state === CircuitBreakerState.OPEN) {
        const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
        if (timeSinceLastFailure > this.options.resetTimeout) {
          this.transitionToHalfOpen();
        }
      }
    }, this.options.monitorInterval);
  }
}
