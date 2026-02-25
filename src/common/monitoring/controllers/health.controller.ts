import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from '../services/health.service';
import { PrometheusService } from '../services/prometheus.service';
import { OpenTelemetryService } from '../services/opentelemetry.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prometheusService: PrometheusService,
    private readonly telemetryService: OpenTelemetryService
  ) {}

  @Get()
  async getHealth(@Res() res: Response) {
    const healthResult = await this.healthService.performHealthChecks();
    
    const statusCode = healthResult.status === 'healthy' 
      ? HttpStatus.OK 
      : healthResult.status === 'degraded' 
      ? HttpStatus.SERVICE_UNAVAILABLE 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    res.status(statusCode).json(healthResult);
  }

  @Get('live')
  async getLiveness(@Res() res: Response) {
    // Simple liveness probe - just check if the service is running
    const result = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    res.status(HttpStatus.OK).json(result);
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    // Readiness probe - check if service is ready to accept traffic
    const healthResult = await this.healthService.performHealthChecks();
    
    const isReady = healthResult.status !== 'unhealthy';
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: healthResult.checks
    });
  }

  @Get('detailed')
  async getDetailedHealth() {
    const healthResult = await this.healthService.performHealthChecks();
    const sloResults = await this.healthService.checkSLOs();
    const businessMetrics = this.prometheusService.getBusinessMetrics();

    return {
      ...healthResult,
      slos: sloResults,
      business_metrics: businessMetrics,
      trace_context: this.telemetryService.getCurrentContext()
    };
  }

  @Get('slos')
  async getSLOs() {
    const sloResults = await this.healthService.checkSLOs();
    
    return {
      timestamp: new Date().toISOString(),
      slos: sloResults
    };
  }
}
