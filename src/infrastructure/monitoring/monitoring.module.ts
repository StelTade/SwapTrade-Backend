import { Module } from '@nestjs/common';
import { MonitoringModule as OriginalMonitoringModule } from '../../common/monitoring/monitoring.module';

/**
 * Infrastructure Monitoring Facade Module
 *
 * Wraps the original MonitoringModule from src/common/monitoring/
 * Provides: StructuredLoggerService, OpenTelemetryService, PrometheusService,
 *           HealthService, MetricsController, MonitoringInterceptor
 */
@Module({
  imports: [
    OriginalMonitoringModule,
  ],
  exports: [
    OriginalMonitoringModule,
  ],
})
export class InfrastructureMonitoringModule {}