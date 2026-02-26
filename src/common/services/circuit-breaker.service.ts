import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker, { Options as OpossumOptions } from 'opossum';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Metrics for a circuit breaker
 */
export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitState;
  successCount: number;
  failureCount: number;
  failurePercentage: number;
  totalRequests: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
}

/**
 * Options for circuit breaker
 */
export interface CircuitBreakerOptions {
  name: string;
  timeout?: number;
  errorThresholdPercentage?: number;
  volumeThreshold?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  fallback?: (...args: any[]) => any;
  healthCheckInterval?: number;
}

/**
 * Service for managing circuit breakers for external service calls
 * Prevents cascading failures and provides fallback mechanisms
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker<any, any>>();
  private readonly metrics = new Map<string, CircuitBreakerMetrics>();

  constructor(private readonly correlationIdService: CorrelationIdService) {}

  /**
   * Register a circuit breaker for an external service call
   */
  register<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: CircuitBreakerOptions,
  ): T {
    const {
      name,
      timeout = 30000,
      errorThresholdPercentage = 50,
      volumeThreshold = 10,
      rollingCountTimeout = 60000,
      rollingCountBuckets = 10,
      fallback,
      healthCheckInterval = 30000,
    } = options;

    if (this.breakers.has(name)) {
      this.logger.warn(`Circuit breaker "${name}" already registered`);
      return fn;
    }

    const opossumOptions: any = {
      timeout,
      errorThresholdPercentage,
      volumeThreshold,
      rollingCountTimeout,
      rollingCountBuckets,
      name,
    };

    const fallbackFn = fallback || ((_error: Error, ...args: any[]) => ({ error: 'Service unavailable', args }));
    const wrappedFn = fallback ? fn : fn;
    
    const breaker = new CircuitBreaker<any, any>(wrappedFn, opossumOptions);

    // Setup event handlers
    this.setupBreakersEventHandlers(breaker, name);

    // Initialize metrics
    this.initializeMetrics(name);

    this.breakers.set(name, breaker);
    this.logger.log(`Circuit breaker registered: ${name}`);

    return fn;
  }

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(
    name: string,
    fn: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> {
    const breaker = this.breakers.get(name);

    if (!breaker) {
      this.logger.warn(`Circuit breaker "${name}" not found, executing without protection`);
      return fn(...args);
    }

    try {
      const correlationId = this.correlationIdService.getCorrelationId();
      const startTime = Date.now();

      const result = await breaker.fire(...args);

      const duration = Date.now() - startTime;
      this.logger.debug(
        `[${correlationId}] Circuit breaker "${name}" executed successfully in ${duration}ms`,
      );

      return result;
    } catch (error) {
      const correlationId = this.correlationIdService.getCorrelationId();
      this.logger.error(
        `[${correlationId}] Circuit breaker "${name}" failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  getState(name: string): CircuitState {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return CircuitState.CLOSED;
    }

    if (breaker.opened) {
      return CircuitState.OPEN;
    }
    if (breaker.halfOpen) {
      return CircuitState.HALF_OPEN;
    }
    return CircuitState.CLOSED;
  }

  /**
   * Get metrics for circuit breaker
   */
  getMetrics(name: string): CircuitBreakerMetrics {
    const metrics = this.metrics.get(name);
    if (!metrics) {
      return this.createEmptyMetrics(name);
    }
    return metrics;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Reset circuit breaker
   */
  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      this.initializeMetrics(name);
      this.logger.log(`Circuit breaker "${name}" reset`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [name, breaker] of this.breakers.entries()) {
      breaker.close();
      this.initializeMetrics(name);
    }
    this.logger.log('All circuit breakers reset');
  }

  /**
   * Setup event handlers for circuit breaker
   */
  private setupBreakersEventHandlers(breaker: CircuitBreaker<any, any>, name: string): void {
    breaker.on('open', () => {
      const correlationId = this.correlationIdService.getCorrelationId();
      this.logger.warn(
        `[${correlationId}] Circuit breaker "${name}" opened - failures detected`,
      );
      const metrics = this.metrics.get(name);
      if (metrics) {
        metrics.openedAt = new Date();
      }
    });

    breaker.on('halfOpen', () => {
      const correlationId = this.correlationIdService.getCorrelationId();
      this.logger.log(
        `[${correlationId}] Circuit breaker "${name}" half-open - testing recovery`,
      );
    });

    breaker.on('close', () => {
      const correlationId = this.correlationIdService.getCorrelationId();
      this.logger.log(`[${correlationId}] Circuit breaker "${name}" closed - service recovered`);
      const metrics = this.metrics.get(name);
      if (metrics) {
        metrics.openedAt = undefined;
      }
    });
  }

  /**
   * Initialize metrics for circuit breaker
   */
  private initializeMetrics(name: string): void {
    const existing = this.metrics.get(name);
    if (existing) {
      existing.successCount = 0;
      existing.failureCount = 0;
      existing.consecutiveFailures = 0;
      existing.consecutiveSuccesses = 0;
      existing.openedAt = undefined;
    } else {
      this.metrics.set(name, this.createEmptyMetrics(name));
    }
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(name: string): CircuitBreakerMetrics {
    return {
      name,
      state: CircuitState.CLOSED,
      successCount: 0,
      failureCount: 0,
      failurePercentage: 0,
      totalRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };
  }
}
