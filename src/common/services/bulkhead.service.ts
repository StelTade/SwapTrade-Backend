import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import { CorrelationIdService } from './correlation-id.service';

/**
 * Bulkhead configuration
 */
export interface BulkheadConfig {
  name: string;
  maxConcurrent: number;
  maxQueueSize?: number;
  timeout?: number;
}

/**
 * Bulkhead metrics
 */
export interface BulkheadMetrics {
  name: string;
  maxConcurrent: number;
  currentConcurrent: number;
  queuedRequests: number;
  totalRequests: number;
  totalRejected: number;
  totalSuccessful: number;
  totalFailed: number;
}

/**
 * Service implementing bulkhead pattern to isolate failure domains
 * Limits concurrent requests to prevent resource exhaustion
 * Isolates failures to prevent them from cascading to other services
 */
@Injectable()
export class BulkheadService {
  private readonly logger = new Logger(BulkheadService.name);
  private readonly bulkheads = new Map<string, any>();
  private readonly metrics = new Map<string, BulkheadMetrics>();
  private readonly trackedExecutions = new Map<string, number>();

  constructor(private readonly correlationIdService: CorrelationIdService) {}

  /**
   * Create a new bulkhead
   */
  createBulkhead(config: BulkheadConfig): void {
    if (this.bulkheads.has(config.name)) {
      this.logger.warn(`Bulkhead "${config.name}" already exists`);
      return;
    }

    const limiter = pLimit(config.maxConcurrent);
    this.bulkheads.set(config.name, {
      limiter,
      config,
      queue: [],
    });

    this.metrics.set(config.name, {
      name: config.name,
      maxConcurrent: config.maxConcurrent,
      currentConcurrent: 0,
      queuedRequests: 0,
      totalRequests: 0,
      totalRejected: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    });

    this.logger.log(
      `Bulkhead created: ${config.name} (max concurrent: ${config.maxConcurrent})`,
    );
  }

  /**
   * Execute function within bulkhead constraints
   */
  async execute<T>(
    bulkheadName: string,
    fn: () => Promise<T>,
    functionName?: string,
  ): Promise<T> {
    const bulkhead = this.bulkheads.get(bulkheadName);

    if (!bulkhead) {
      this.logger.warn(`Bulkhead "${bulkheadName}" not found`);
      return fn();
    }

    const correlationId = this.correlationIdService.getCorrelationId();
    const metrics = this.metrics.get(bulkheadName)!;
    const startTime = Date.now();

    try {
      metrics.totalRequests++;
      metrics.queuedRequests++;

      this.logger.debug(
        `[${correlationId}] ${functionName || 'Task'} queued in bulkhead "${bulkheadName}" (queued: ${metrics.queuedRequests})`,
      );

      const result = await bulkhead.limiter(async () => {
        metrics.queuedRequests--;
        metrics.currentConcurrent++;

        try {
          this.logger.debug(
            `[${correlationId}] ${functionName || 'Task'} executing in bulkhead "${bulkheadName}" (concurrent: ${metrics.currentConcurrent})`,
          );

          const result = await Promise.race([
            fn(),
            this.createTimeoutPromise(bulkhead.config.timeout),
          ]);

          const duration = Date.now() - startTime;
          this.logger.debug(
            `[${correlationId}] ${functionName || 'Task'} completed in bulkhead "${bulkheadName}" (${duration}ms)`,
          );

          metrics.totalSuccessful++;
          return result;
        } catch (error) {
          metrics.totalFailed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `[${correlationId}] ${functionName || 'Task'} failed in bulkhead "${bulkheadName}": ${errorMsg}`,
          );
          throw error;
        } finally {
          metrics.currentConcurrent--;
        }
      });

      return result;
    } catch (error) {
      metrics.totalRejected++;
      throw error;
    }
  }

  /**
   * Get bulkhead metrics
   */
  getMetrics(bulkheadName: string): BulkheadMetrics | undefined {
    return this.metrics.get(bulkheadName);
  }

  /**
   * Get all bulkhead metrics
   */
  getAllMetrics(): BulkheadMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get all bulkhead names
   */
  getBulkheadNames(): string[] {
    return Array.from(this.bulkheads.keys());
  }

  /**
   * Reset bulkhead metrics
   */
  resetMetrics(bulkheadName: string): void {
    const metrics = this.metrics.get(bulkheadName);
    if (metrics) {
      metrics.currentConcurrent = 0;
      metrics.queuedRequests = 0;
      metrics.totalRequests = 0;
      metrics.totalRejected = 0;
      metrics.totalSuccessful = 0;
      metrics.totalFailed = 0;
      this.logger.log(`Bulkhead "${bulkheadName}" metrics reset`);
    }
  }

  /**
   * Remove bulkhead
   */
  removeBulkhead(bulkheadName: string): void {
    this.bulkheads.delete(bulkheadName);
    this.metrics.delete(bulkheadName);
    this.logger.log(`Bulkhead "${bulkheadName}" removed`);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeoutMs?: number): Promise<never> {
    if (!timeoutMs) {
      return new Promise(() => {}); // Never resolves, effectively no timeout
    }

    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Bulkhead operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
  }
}
