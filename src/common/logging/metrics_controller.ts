// src/common/logging/metrics.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { MetricsService } from './metrics_service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getAllMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metricsService.getAllMetrics(),
    };
  }

  @Get('requests/:route')
  getRequestMetrics(@Param('route') route: string) {
    const metrics = this.metricsService.getRequestMetrics(route);
    const errorRate = this.metricsService.getErrorRate(route);

    return {
      route,
      metrics,
      errorRate,
    };
  }

  @Get('queries/:query')
  getQueryMetrics(@Param('query') query: string) {
    return {
      query,
      metrics: this.metricsService.getQueryMetrics(query),
    };
  }

  @Get('health')
  getHealthStatus() {
    const allMetrics = this.metricsService.getAllMetrics();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check error rates
    for (const [route, data] of Object.entries(allMetrics.requests)) {
      const errorRate = (data as any).errorRate.rate;
      if (errorRate > 0.01) {
        health.status = 'degraded';
        health.checks[`error_rate_${route}`] = {
          status: 'warning',
          value: `${(errorRate * 100).toFixed(2)}%`,
        };
      }
    }

    return health;
  }
}