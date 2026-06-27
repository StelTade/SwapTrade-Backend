import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StructuredLoggerService } from './services/structured-logger.service';
import { OpenTelemetryService } from './services/opentelemetry.service';
import { PrometheusService } from './services/prometheus.service';
import { HealthService } from './services/health.service';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MonitoringInterceptor } from './interceptors/monitoring.interceptor';
import { TraceInterceptor } from './interceptors/trace.interceptor';
import { TypeOrmTracingSubscriber } from './subscribers/typeorm-tracing.subscriber';
import { LogLevel, MonitoringConfig } from './interfaces/monitoring.interfaces';

/**
 * Default monitoring configuration — values are resolved from environment
 * variables at startup. The same vars are documented in .env.example.
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
    // Unified env-var names — OTEL_ENABLED / OTEL_SAMPLING_RATE
    enabled: process.env.OTEL_ENABLED === 'true',
    samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE ?? '1.0'),
    exportInterval: parseInt(process.env.OTEL_EXPORT_INTERVAL ?? '5000', 10),
    headers: {},
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'swaptrade-backend',
    serviceVersion:
      process.env.OTEL_SERVICE_VERSION ?? process.env.APP_VERSION ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false', // default true
    port: parseInt(process.env.METRICS_PORT ?? '9090', 10),
    path: process.env.METRICS_PATH ?? '/metrics',
    collectDefaultMetrics: process.env.METRICS_COLLECT_DEFAULT !== 'false',
  },
  health: {
    enabled: process.env.HEALTH_ENABLED !== 'false',
    path: process.env.HEALTH_PATH ?? '/health',
    detailed: process.env.HEALTH_DETAILED !== 'false',
  },
  alerting: {
    enabled: process.env.ALERTING_ENABLED === 'true',
    webhookUrl: process.env.ALERTING_WEBHOOK_URL,
    slackWebhook: process.env.ALERTING_SLACK_WEBHOOK,
    emailRecipients: process.env.ALERTING_EMAIL_RECIPIENTS?.split(','),
  },
};

@Module({
  imports: [
    // Required by TypeOrmTracingSubscriber for @InjectDataSource()
    TypeOrmModule.forFeature([]),
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    // ── Configuration token ───────────────────────────────────────────────
    {
      provide: 'MONITORING_CONFIG',
      useValue: defaultMonitoringConfig,
    },

    // ── Core monitoring services ──────────────────────────────────────────
    StructuredLoggerService,
    {
      provide: OpenTelemetryService,
      useFactory: (config: MonitoringConfig) =>
        new OpenTelemetryService(config?.tracing),
      inject: ['MONITORING_CONFIG'],
    },
    PrometheusService,
    HealthService,

    // ── Global HTTP monitoring interceptor ────────────────────────────────
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },

    // ── @Trace() decorator interceptor (exported for per-handler use) ─────
    TraceInterceptor,

    // ── TypeORM query tracing subscriber ─────────────────────────────────
    TypeOrmTracingSubscriber,
  ],
  exports: [
    StructuredLoggerService,
    OpenTelemetryService,
    PrometheusService,
    HealthService,
    TraceInterceptor,
  ],
})
export class MonitoringModule {}
