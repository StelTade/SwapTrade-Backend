import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusService } from '../services/prometheus.service';
import { OpenTelemetryService } from '../services/opentelemetry.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly telemetryService: OpenTelemetryService
  ) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = this.prometheusService.getMetrics();
    
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  }

  @Get('business')
  async getBusinessMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.prometheusService.getBusinessMetrics()
    };
  }

  @Get('custom')
  async getCustomMetrics() {
    // Return custom application metrics in JSON format
    const businessMetrics = this.prometheusService.getBusinessMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      application: {
        trades_per_second: businessMetrics.tradesPerSecond,
        total_volume: businessMetrics.totalVolume,
        active_users: businessMetrics.activeUsers,
        portfolio_value: businessMetrics.portfolioValue,
        order_book_depth: businessMetrics.orderBookDepth,
        latency: businessMetrics.latency,
        error_rate: businessMetrics.errorRate,
        throughput: businessMetrics.throughput
      },
      system: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      },
      trace_context: this.telemetryService.getCurrentContext()
    };
  }
}
