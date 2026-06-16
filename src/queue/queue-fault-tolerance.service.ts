// src/queue/queue-fault-tolerance.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CircuitBreakerState,
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';

/**
 * Circuit Breaker for a specific service/queue
 */
interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastStateChange: Date;
  nextRetryTime?: Date;
}

/**
 * Failover target
 */
export interface FailoverTarget {
  targetId: string;
  priority: number;
  isAvailable: boolean;
  lastHealthCheck: Date;
  consecutiveFailures: number;
}

/**
 * Queue Fault Tolerance Service
 * Provides circuit breaker, failover, and retry mechanisms
 */
@Injectable()
export class QueueFaultToleranceService {
  private readonly logger = new Logger(QueueFaultToleranceService.name);
  private config: HorizontalScalingConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private failoverTargets: Map<string, FailoverTarget[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(private eventEmitter: EventEmitter2) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.logger.log('Queue Fault Tolerance Service initialized');
  }

  // ==================== Circuit Breaker ====================

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(serviceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: new Date(),
      });
    }
    return this.circuitBreakers.get(serviceId)!;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(serviceId: string): void {
    const breaker = this.getCircuitBreaker(serviceId);
    breaker.successCount++;
    breaker.failureCount = 0;

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Service recovered, close the circuit
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.lastStateChange = new Date();
      this.logger.log(`Circuit breaker CLOSED for ${serviceId} (service recovered)`);
      this.eventEmitter.emit('circuit-breaker.closed', { serviceId });
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(serviceId: string): void {
    const breaker = this.getCircuitBreaker(serviceId);
    breaker.failureCount++;
    breaker.successCount = 0;
    breaker.lastFailureTime = new Date();

    if (breaker.state === CircuitBreakerState.CLOSED) {
      // Check if threshold exceeded
      const failureRate = breaker.failureCount / (breaker.failureCount + breaker.successCount);
      if (failureRate >= this.config.faultTolerance.circuitBreakerThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        breaker.lastStateChange = new Date();
        breaker.nextRetryTime = new Date(
          Date.now() + this.config.faultTolerance.circuitBreakerResetTimeoutMs,
        );
        this.logger.warn(`Circuit breaker OPEN for ${serviceId} (failure rate: ${(failureRate * 100).toFixed(1)}%)`);
        this.eventEmitter.emit('circuit-breaker.opened', { serviceId, failureRate });
      }
    } else if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Failed during test, open again
      breaker.state = CircuitBreakerState.OPEN;
      breaker.lastStateChange = new Date();
      breaker.nextRetryTime = new Date(
        Date.now() + this.config.faultTolerance.circuitBreakerResetTimeoutMs,
      );
      this.logger.warn(`Circuit breaker OPEN for ${serviceId} (failed during half-open test)`);
      this.eventEmitter.emit('circuit-breaker.opened', { serviceId });
    }
  }

  /**
   * Check if request is allowed through circuit breaker
   */
  isRequestAllowed(serviceId: string): boolean {
    if (!this.config.faultTolerance.enableCircuitBreaker) {
      return true;
    }

    const breaker = this.getCircuitBreaker(serviceId);

    switch (breaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Check if enough time has passed to try again
        if (breaker.nextRetryTime && new Date() >= breaker.nextRetryTime) {
          breaker.state = CircuitBreakerState.HALF_OPEN;
          breaker.lastStateChange = new Date();
          this.logger.log(`Circuit breaker HALF_OPEN for ${serviceId} (testing recovery)`);
          this.eventEmitter.emit('circuit-breaker.half-open', { serviceId });
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // Allow one request to test
        return true;

      default:
        return false;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(serviceId: string): CircuitBreakerState {
    return this.getCircuitBreaker(serviceId).state;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(serviceId: string): void {
    const breaker = this.getCircuitBreaker(serviceId);
    breaker.state = CircuitBreakerState.CLOSED;
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.lastStateChange = new Date();
    breaker.nextRetryTime = undefined;
    this.logger.log(`Circuit breaker RESET for ${serviceId}`);
    this.eventEmitter.emit('circuit-breaker.reset', { serviceId });
  }

  // ==================== Failover ====================

  /**
   * Register failover target
   */
  registerFailoverTarget(
    serviceId: string,
    targetId: string,
    priority: number = 1,
  ): void {
    if (!this.failoverTargets.has(serviceId)) {
      this.failoverTargets.set(serviceId, []);
    }

    const targets = this.failoverTargets.get(serviceId)!;
    const existing = targets.find((t) => t.targetId === targetId);

    if (existing) {
      existing.priority = priority;
      existing.isAvailable = true;
    } else {
      targets.push({
        targetId,
        priority,
        isAvailable: true,
        lastHealthCheck: new Date(),
        consecutiveFailures: 0,
      });
    }

    // Sort by priority
    targets.sort((a, b) => a.priority - b.priority);
    
    this.logger.log(`Failover target registered: ${targetId} for ${serviceId} (priority: ${priority})`);
  }

  /**
   * Unregister failover target
   */
  unregisterFailoverTarget(serviceId: string, targetId: string): boolean {
    const targets = this.failoverTargets.get(serviceId);
    if (!targets) {
      return false;
    }

    const index = targets.findIndex((t) => t.targetId === targetId);
    if (index === -1) {
      return false;
    }

    targets.splice(index, 1);
    this.logger.log(`Failover target unregistered: ${targetId} from ${serviceId}`);
    return true;
  }

  /**
   * Get next available failover target
   */
  getNextFailoverTarget(serviceId: string): FailoverTarget | null {
    const targets = this.failoverTargets.get(serviceId);
    if (!targets || targets.length === 0) {
      return null;
    }

    // Find first available target
    const available = targets.find((t) => t.isAvailable);
    return available || null;
  }

  /**
   * Mark failover target as unavailable
   */
  markTargetUnavailable(serviceId: string, targetId: string): void {
    const targets = this.failoverTargets.get(serviceId);
    if (!targets) {
      return;
    }

    const target = targets.find((t) => t.targetId === targetId);
    if (target) {
      target.isAvailable = false;
      target.consecutiveFailures++;
      target.lastHealthCheck = new Date();
      this.logger.warn(`Failover target marked unavailable: ${targetId} for ${serviceId}`);
      this.eventEmitter.emit('failover.target-unavailable', { serviceId, targetId });
    }
  }

  /**
   * Mark failover target as available
   */
  markTargetAvailable(serviceId: string, targetId: string): void {
    const targets = this.failoverTargets.get(serviceId);
    if (!targets) {
      return;
    }

    const target = targets.find((t) => t.targetId === targetId);
    if (target) {
      target.isAvailable = true;
      target.consecutiveFailures = 0;
      target.lastHealthCheck = new Date();
      this.logger.log(`Failover target marked available: ${targetId} for ${serviceId}`);
      this.eventEmitter.emit('failover.target-available', { serviceId, targetId });
    }
  }

  /**
   * Execute with failover
   */
  async executeWithFailover<T>(
    serviceId: string,
    operation: (targetId: string) => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (!this.config.faultTolerance.enableFailover) {
      return operation(serviceId);
    }

    const maxAttempts = this.config.faultTolerance.maxFailoverAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const target = this.getNextFailoverTarget(serviceId);
      
      if (!target) {
        this.logger.error(`No available failover targets for ${serviceId}`);
        break;
      }

      try {
        const result = await operation(target.targetId);
        this.markTargetAvailable(serviceId, target.targetId);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Failover attempt ${attempt + 1} failed for ${serviceId} (target: ${target.targetId}): ${error}`,
        );
        this.markTargetUnavailable(serviceId, target.targetId);

        if (attempt < maxAttempts - 1) {
          // Wait before next attempt
          await this.delay(this.config.faultTolerance.failoverDelayMs);
        }
      }
    }

    // All failover attempts failed
    if (fallback) {
      this.logger.log(`Executing fallback for ${serviceId}`);
      return fallback();
    }

    throw lastError || new Error(`All failover attempts failed for ${serviceId}`);
  }

  // ==================== Retry Logic ====================

  /**
   * Get retry count for a job
   */
  getRetryCount(jobId: string): number {
    return this.retryAttempts.get(jobId) || 0;
  }

  /**
   * Increment retry count for a job
   */
  incrementRetryCount(jobId: string): number {
    const current = this.getRetryCount(jobId);
    const newCount = current + 1;
    this.retryAttempts.set(jobId, newCount);
    return newCount;
  }

  /**
   * Reset retry count for a job
   */
  resetRetryCount(jobId: string): void {
    this.retryAttempts.delete(jobId);
  }

  /**
   * Check if job should be retried
   */
  shouldRetry(jobId: string, maxAttempts: number = 3): boolean {
    const retryCount = this.getRetryCount(jobId);
    return retryCount < maxAttempts;
  }

  // ==================== Health Checks ====================

  /**
   * Perform health check on all circuit breakers
   */
  healthCheck(): {
    healthy: boolean;
    circuitBreakers: Record<string, { state: CircuitBreakerState; failureCount: number }>;
    issues: string[];
  } {
    const issues: string[] = [];
    const breakerStatuses: Record<string, { state: CircuitBreakerState; failureCount: number }> = {};

    for (const [serviceId, breaker] of this.circuitBreakers.entries()) {
      breakerStatuses[serviceId] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
      };

      if (breaker.state === CircuitBreakerState.OPEN) {
        issues.push(`Circuit breaker OPEN for ${serviceId}`);
      }
    }

    return {
      healthy: issues.length === 0,
      circuitBreakers: breakerStatuses,
      issues,
    };
  }

  /**
   * Get all circuit breaker states
   */
  getAllCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    for (const [serviceId, breaker] of this.circuitBreakers.entries()) {
      states.set(serviceId, breaker.state);
    }
    return states;
  }

  /**
   * Get all failover targets
   */
  getAllFailoverTargets(): Map<string, FailoverTarget[]> {
    return new Map(this.failoverTargets);
  }

  // ==================== Utilities ====================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Fault tolerance configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}