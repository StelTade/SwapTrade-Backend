import { Injectable } from '@nestjs/common';

export interface RedisMetricsSnapshot {
  poolAvailable: number;
  poolInUse: number;
  poolSize: number;
  totalAcquired: number;
  totalReleased: number;
  totalRetries: number;
  totalConnectionErrors: number;
  totalPoolExhaustions: number;
  circuitBreakerState: string;
  circuitBreakerFailures: number;
}

/**
 * In-memory metrics for Redis pool utilization and retries.
 * Can be exposed as Prometheus-style gauges/counters or JSON.
 */
@Injectable()
export class RedisMetricsService {
  private poolAvailable = 0;
  private poolInUse = 0;
  private poolSize = 0;
  private totalAcquired = 0;
  private totalReleased = 0;
  private totalRetries = 0;
  private totalConnectionErrors = 0;
  private totalPoolExhaustions = 0;
  private circuitBreakerState = 'closed';
  private circuitBreakerFailures = 0;

  recordAcquire(available: number, inUse: number): void {
    this.poolAvailable = available;
    this.poolInUse = inUse;
    this.poolSize = available + inUse;
    this.totalAcquired++;
  }

  recordRelease(available: number, inUse: number): void {
    this.poolAvailable = available;
    this.poolInUse = inUse;
    this.poolSize = available + inUse;
    this.totalReleased++;
  }

  recordRetry(attempt: number): void {
    this.totalRetries++;
  }

  recordConnectionError(): void {
    this.totalConnectionErrors++;
  }

  recordPoolExhaustion(): void {
    this.totalPoolExhaustions++;
  }

  setCircuitBreakerState(state: string): void {
    this.circuitBreakerState = state;
  }

  recordCircuitBreakerFailure(): void {
    this.circuitBreakerFailures++;
  }

  getSnapshot(): RedisMetricsSnapshot {
    return {
      poolAvailable: this.poolAvailable,
      poolInUse: this.poolInUse,
      poolSize: this.poolSize,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      totalRetries: this.totalRetries,
      totalConnectionErrors: this.totalConnectionErrors,
      totalPoolExhaustions: this.totalPoolExhaustions,
      circuitBreakerState: this.circuitBreakerState,
      circuitBreakerFailures: this.circuitBreakerFailures,
    };
  }

  reset(): void {
    this.totalRetries = 0;
    this.totalConnectionErrors = 0;
    this.totalPoolExhaustions = 0;
    this.circuitBreakerFailures = 0;
  }
}
