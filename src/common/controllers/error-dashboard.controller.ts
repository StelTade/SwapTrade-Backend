import { Controller, Get, Query, Post, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ErrorMonitoringService } from '../services/error-monitoring.service';
import type { ErrorMetrics } from '../services/error-monitoring.service';
import { CircuitBreakerService, CircuitBreakerMetrics } from '../services/circuit-breaker.service';
import { BulkheadService, BulkheadMetrics } from '../services/bulkhead.service';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';

/**
 * Dashboard API for error monitoring and system health
 */
@Controller('api/dashboard')
@ApiTags('Dashboard')
export class ErrorDashboardController {
  private readonly logger = new Logger(ErrorDashboardController.name);

  constructor(
    private readonly errorMonitoringService: ErrorMonitoringService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
    private readonly deadLetterQueueService: DeadLetterQueueService,
  ) {}

  /**
   * Get error metrics
   */
  @Get('errors/metrics')
  @ApiOperation({ summary: 'Get error metrics and trends' })
  getErrorMetrics(): ErrorMetrics {
    return this.errorMonitoringService.getMetrics();
  }

  /**
   * Get error statistics
   */
  @Get('errors/stats')
  @ApiOperation({ summary: 'Get error statistics by category' })
  getErrorStats() {
    const metrics = this.errorMonitoringService.getMetrics();

    return {
      totalErrors: metrics.totalErrors,
      byCategory: metrics.errorsByCategory,
      bySeverity: metrics.errorsBySeverity,
      byCode: metrics.errorsByCode,
      topErrors: metrics.topErrors,
      errorRatePerMinute: metrics.errorRatePerMinute,
      errorRatePerHour: metrics.errorRatePerHour,
    };
  }

  /**
   * Get recent errors
   */
  @Get('errors/recent')
  @ApiOperation({ summary: 'Get recent errors' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentErrors(@Query('limit') limit?: number) {
    const metrics = this.errorMonitoringService.getMetrics();
    const errors = metrics.recentErrors;

    if (limit) {
      return errors.slice(-limit);
    }

    return errors;
  }

  /**
   * Get critical errors
   */
  @Get('errors/critical')
  @ApiOperation({ summary: 'Get critical errors' })
  getCriticalErrors() {
    return this.errorMonitoringService.getCriticalErrors();
  }

  /**
   * Get circuit breaker status
   */
  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  getCircuitBreakers(): CircuitBreakerMetrics[] {
    return this.circuitBreakerService.getAllMetrics();
  }

  /**
   * Get circuit breaker details
   */
  @Get('circuit-breakers/:name')
  @ApiOperation({ summary: 'Get circuit breaker details' })
  getCircuitBreakerDetails(@Param('name') name: string) {
    const state = this.circuitBreakerService.getState(name);
    const metrics = this.circuitBreakerService.getMetrics(name);

    return {
      state,
      metrics,
    };
  }

  /**
   * Reset circuit breaker
   */
  @Post('circuit-breakers/:name/reset')
  @ApiOperation({ summary: 'Reset circuit breaker' })
  resetCircuitBreaker(@Param('name') name: string) {
    this.circuitBreakerService.reset(name);

    return {
      success: true,
      message: `Circuit breaker "${name}" reset successfully`,
    };
  }

  /**
   * Get bulkhead status
   */
  @Get('bulkheads')
  @ApiOperation({ summary: 'Get bulkhead status' })
  getBulkheads(): BulkheadMetrics[] {
    return this.bulkheadService.getAllMetrics();
  }

  /**
   * Get bulkhead details
   */
  @Get('bulkheads/:name')
  @ApiOperation({ summary: 'Get bulkhead details' })
  getBulkheadDetails(@Param('name') name: string) {
    const metrics = this.bulkheadService.getMetrics(name);

    return {
      metrics,
    };
  }

  /**
   * Get dead letter queue status
   */
  @Get('dlq/stats')
  @ApiOperation({ summary: 'Get dead letter queue statistics' })
  getDLQStats() {
    return this.deadLetterQueueService.getDLQStats();
  }

  /**
   * Get dead letter queue messages
   */
  @Get('dlq/:queueName')
  @ApiOperation({ summary: 'Get dead letter queue messages' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDLQMessages(
    @Param('queueName') queueName: string,
    @Query('limit') limit?: number,
  ) {
    const messages = this.deadLetterQueueService.getDLQMessages(queueName, limit);

    return {
      queueName,
      totalMessages: messages.length,
      messages,
    };
  }

  /**
   * Get system health
   */
  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  getSystemHealth() {
    const errorMetrics = this.errorMonitoringService.getMetrics();
    const criticalErrors = this.errorMonitoringService.getCriticalErrors();
    const dlqStats = this.deadLetterQueueService.getDLQStats();

    // Calculate health score (0-100)
    let healthScore = 100;

    // Reduce score based on critical errors
    if (criticalErrors.length > 0) {
      healthScore -= Math.min(50, criticalErrors.length * 10);
    }

    // Reduce score based on error rate
    if (errorMetrics.errorRatePerMinute > 5) {
      healthScore -= Math.min(30, errorMetrics.errorRatePerMinute);
    }

    // Reduce score based on DLQ messages
    let totalDLQMessages = 0;
    for (const queueStats of Object.values(dlqStats)) {
      totalDLQMessages += (queueStats as any).totalMessages || 0;
    }

    if (totalDLQMessages > 100) {
      healthScore -= Math.min(20, totalDLQMessages / 50);
    }

    const status =
      healthScore >= 80
        ? 'HEALTHY'
        : healthScore >= 60
          ? 'DEGRADED'
          : 'UNHEALTHY';

    return {
      status,
      healthScore: Math.max(0, Math.round(healthScore)),
      timestamp: new Date(),
      details: {
        totalErrors: errorMetrics.totalErrors,
        criticalErrors: criticalErrors.length,
        errorRatePerMinute: errorMetrics.errorRatePerMinute,
        openCircuitBreakers: this.circuitBreakerService
          .getAllMetrics()
          .filter((cb) => cb.state === 'OPEN').length,
        dlqMessages: totalDLQMessages,
      },
    };
  }

  /**
   * Get error dashboard summary
   */
  @Get('/summary')
  @ApiOperation({ summary: 'Get error dashboard summary' })
  getDashboardSummary() {
    const errorMetrics = this.errorMonitoringService.getMetrics();
    const health = this.getSystemHealth();
    const circuitBreakers = this.circuitBreakerService.getAllMetrics();
    const bulkheads = this.bulkheadService.getAllMetrics();

    return {
      timestamp: new Date(),
      health: health,
      errors: {
        total: errorMetrics.totalErrors,
        byCategory: errorMetrics.errorsByCategory,
        bySeverity: errorMetrics.errorsBySeverity,
        topErrors: errorMetrics.topErrors,
      },
      circuitBreakers: {
        total: circuitBreakers.length,
        open: circuitBreakers.filter((cb) => cb.state === 'OPEN').length,
        halfOpen: circuitBreakers.filter((cb) => cb.state === 'HALF_OPEN').length,
      },
      bulkheads: {
        total: bulkheads.length,
        totalConcurrent: bulkheads.reduce((sum, b) => sum + b.currentConcurrent, 0),
        totalQueued: bulkheads.reduce((sum, b) => sum + b.queuedRequests, 0),
      },
    };
  }
}
