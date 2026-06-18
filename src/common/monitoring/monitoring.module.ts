import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StructuredLoggerService } from './services/structured-logger.service';
import { OpenTelemetryService } from './services/opentelemetry.service';
import { PrometheusService } from './services/prometheus.service';
import { HealthService } from './services/health.service';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MonitoringInterceptor } from './interceptors/monitoring.interceptor';
import { LogLevel, MonitoringConfig } from './interfaces/monitoring.interfaces';

/**
 * Default monitoring configuration
 */
const defaultMonitoringConfig: MonitoringConfig = {
  logging: {
    level: LogLevel.INFO,
    format: 'json',
    correlationId: true,
    structured: true,
    console: true,
    file: {
      enabled: true,
      path: './logs/app.log',
      maxSize: '100MB',
      maxFiles: 10,
    },
  },
  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true' || false,
    samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '1.0'),
    exportInterval: parseInt(process.env.TRACING_EXPORT_INTERVAL || '5000', 10),
    headers: {},
    serviceName: 'swaptrade-backend',
    serviceVersion: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true' || true,
    port: parseInt(process.env.METRICS_PORT || '9090', 10),
    path: process.env.METRICS_PATH || '/metrics',
    collectDefaultMetrics:
      process.env.METRICS_COLLECT_DEFAULT === 'true' || true,
  },
  health: {
    enabled: process.env.HEALTH_ENABLED === 'true' || true,
    path: process.env.HEALTH_PATH || '/health',
    detailed: process.env.HEALTH_DETAILED === 'true' || true,
  },
  alerting: {
    enabled: process.env.ALERTING_ENABLED === 'true' || false,
    webhookUrl: process.env.ALERTING_WEBHOOK_URL,
    slackWebhook: process.env.ALERTING_SLACK_WEBHOOK,
    emailRecipients: process.env.ALERTING_EMAIL_RECIPIENTS?.split(','),
  },
};

@Module({
  controllers: [HealthController, MetricsController],
  providers: [
    {
      provide: 'MONITORING_CONFIG',
      useValue: defaultMonitoringConfig,
    },
    StructuredLoggerService,
    {
      provide: OpenTelemetryService,
      useFactory: (config: MonitoringConfig) => {
        return new OpenTelemetryService(config?.tracing);
      },
      inject: ['MONITORING_CONFIG'],
    },
    PrometheusService,
    HealthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
  exports: [
    StructuredLoggerService,
    OpenTelemetryService,
    PrometheusService,
    HealthService,
  ],
})
export class MonitoringModule {}
