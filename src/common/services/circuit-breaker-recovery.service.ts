import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitState } from './circuit-breaker.service';

/**
 * Service for automated recovery of circuit breakers
 * Periodically checks circuit breaker states and attempts recovery
 */
@Injectable()
export class CircuitBreakerRecoveryService {
  private readonly logger = new Logger(CircuitBreakerRecoveryService.name);
  private readonly recoveryCheckInterval = 60000; // 1 minute
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(private readonly circuitBreakerService: CircuitBreakerService) {}

  /**
   * Cron job to check and attempt recovery of open circuit breakers
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndRecoverCircuitBreakers(): Promise<void> {
    try {
      const allMetrics = this.circuitBreakerService.getAllMetrics();
      const openBreakers = allMetrics.filter(
        (m) => m.state === CircuitState.OPEN || m.state === CircuitState.HALF_OPEN,
      );

      if (openBreakers.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${openBreakers.length} circuit breakers in OPEN/HALF_OPEN state, attempting recovery`,
      );

      for (const metrics of openBreakers) {
        await this.attemptRecovery(metrics.name);
      }
    } catch (error) {
      this.logger.error(`Error during circuit breaker recovery check: ${error}`);
    }
  }

  /**
   * Attempt to recover a specific circuit breaker
   */
  private async attemptRecovery(breakerName: string): Promise<void> {
    try {
      const state = this.circuitBreakerService.getState(breakerName);
      const metrics = this.circuitBreakerService.getMetrics(breakerName);

      this.logger.debug(
        `Checking recovery for circuit breaker "${breakerName}" - State: ${state}`,
      );

      // If circuit has been open for more than 5 minutes, attempt reset
      if (state === CircuitState.OPEN && metrics.openedAt) {
        const timeSinceOpen = Date.now() - metrics.openedAt.getTime();
        const recoveryThreshold = 5 * 60 * 1000; // 5 minutes

        if (timeSinceOpen > recoveryThreshold) {
          this.logger.log(
            `Attempting to reset circuit breaker "${breakerName}" after ${timeSinceOpen}ms`,
          );
          this.circuitBreakerService.reset(breakerName);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to recover circuit breaker "${breakerName}": ${error}`);
    }
  }

  /**
   * Manual trigger for recovery check (can be called from health endpoints)
   */
  async triggerRecoveryCheck(): Promise<{ recovered: string[]; failed: string[] }> {
    const allMetrics = this.circuitBreakerService.getAllMetrics();
    const openBreakers = allMetrics.filter(
      (m) => m.state === CircuitState.OPEN || m.state === CircuitState.HALF_OPEN,
    );

    const recovered: string[] = [];
    const failed: string[] = [];

    for (const metrics of openBreakers) {
      try {
        await this.attemptRecovery(metrics.name);
        recovered.push(metrics.name);
      } catch (error) {
        failed.push(metrics.name);
      }
    }

    return { recovered, failed };
  }

  /**
   * Get recovery status for all circuit breakers
   */
  getRecoveryStatus(): {
    total: number;
    open: number;
    halfOpen: number;
    closed: number;
    details: any[];
  } {
    const allMetrics = this.circuitBreakerService.getAllMetrics();

    const open = allMetrics.filter((m) => m.state === CircuitState.OPEN).length;
    const halfOpen = allMetrics.filter((m) => m.state === CircuitState.HALF_OPEN).length;
    const closed = allMetrics.filter((m) => m.state === CircuitState.CLOSED).length;

    return {
      total: allMetrics.length,
      open,
      halfOpen,
      closed,
      details: allMetrics.map((m) => ({
        name: m.name,
        state: m.state,
        failureCount: m.failureCount,
        successCount: m.successCount,
        openedAt: m.openedAt,
      })),
    };
  }
}
