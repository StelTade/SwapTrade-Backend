/**
 * Infrastructure Monitoring Module
 * Prometheus metrics, Grafana dashboards, health checks, alerts
 *
 * Facade over src/common/monitoring/ + src/metrics/ — original locations
 */

export { InfrastructureMonitoringModule } from './monitoring.module';
export { MonitoringModule } from '../../common/monitoring/monitoring.module';
export { MetricsModule } from '../../metrics/metrics.module';
export { PrometheusService } from '../../common/monitoring/services/prometheus.service';
export { StructuredLoggerService } from '../../common/monitoring/services/structured-logger.service';
export { HealthService } from '../../common/monitoring/services/health.service';
