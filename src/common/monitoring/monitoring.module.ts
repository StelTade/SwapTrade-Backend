import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StructuredLoggerService } from './services/structured-logger.service';
import { OpenTelemetryService } from './services/opentelemetry.service';
import { PrometheusService } from './services/prometheus.service';
import { HealthService } from './services/health.service';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MonitoringInterceptor } from './interceptors/monitoring.interceptor';
import { MonitoringConfig } from './interfaces/monitoring.interfaces';

@Module({
  controllers: [
    HealthController,
    MetricsController
  ],
  providers: [
    {
      provide: StructuredLoggerService,
      useFactory: (config?: MonitoringConfig) => {
        return new StructuredLoggerService(config);
      },
      inject: ['MONITORING_CONFIG']
    },
    {
      provide: OpenTelemetryService,
      useFactory: (config?: MonitoringConfig) => {
        return new OpenTelemetryService(config?.tracing);
      },
      inject: ['MONITORING_CONFIG']
    },
    PrometheusService,
    HealthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor
    }
  ],
  exports: [
    StructuredLoggerService,
    OpenTelemetryService,
    PrometheusService,
    HealthService
  ]
})
export class MonitoringModule {}
