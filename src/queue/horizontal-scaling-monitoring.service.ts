// src/queue/horizontal-scaling-monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  HorizontalScalingConfig,
  DEFAULT_HORIZONTAL_SCALING_CONFIG,
} from './horizontal-scaling.config';
import { QueueWorkerManagerService } from './queue-worker-manager.service';
import { QueueLoadBalancerService } from './queue-load-balancer.service';
import { QueueFaultToleranceService } from './queue-fault-tolerance.service';
import { MessageDeduplicationService } from './message-deduplication.service';
import { MessageOrderingService } from './message-ordering.service';

/**
 * Alert levels
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  level: AlertLevel;
  component: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  acknowledged: boolean;
}

/**
 * System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  components: {
    workers: { status: string; details: any };
    loadBalancer: { status: string; details: any };
    faultTolerance: { status: string; details: any };
    deduplication: { status: string; details: any };
    ordering: { status: string; details: any };
  };
  alerts: Alert[];
  timestamp: Date;
}

/**
 * Horizontal Scaling Monitoring Service
 * Provides comprehensive monitoring and alerting for the scaling system
 */
@Injectable()
export class HorizontalScalingMonitoringService {
  private readonly logger = new Logger(HorizontalScalingMonitoringService.name);
  private config: HorizontalScalingConfig;
  private alerts: Alert[] = [];
  private alertIdCounter = 0;
  private metricsHistory: Array<{
    timestamp: Date;
    workers: any;
    loadBalancer: any;
    faultTolerance: any;
    deduplication: any;
    ordering: any;
  }> = [];

  constructor(
    private eventEmitter: EventEmitter2,
    private workerManager: QueueWorkerManagerService,
    private loadBalancer: QueueLoadBalancerService,
    private faultTolerance: QueueFaultToleranceService,
    private deduplication: MessageDeduplicationService,
    private ordering: MessageOrderingService,
  ) {
    this.config = DEFAULT_HORIZONTAL_SCALING_CONFIG;
    this.setupEventListeners();
    this.logger.log('Horizontal Scaling Monitoring Service initialized');
  }

  /**
   * Setup event listeners for alerts
   */
  private setupEventListeners(): void {
    // Worker events
    this.eventEmitter.on('worker.registered', (worker) => {
      this.createAlert(
        AlertLevel.INFO,
        'workers',
        `Worker registered: ${worker.workerId}`,
        { worker },
      );
    });

    this.eventEmitter.on('worker.unregistered', (worker) => {
      this.createAlert(
        AlertLevel.INFO,
        'workers',
        `Worker unregistered: ${worker.workerId}`,
        { worker },
      );
    });

    this.eventEmitter.on('worker.unhealthy', (worker) => {
      this.createAlert(
        AlertLevel.WARNING,
        'workers',
        `Worker unhealthy: ${worker.workerId}`,
        { worker },
      );
    });

    // Scaling events
    this.eventEmitter.on('queue.scaled-up', (event) => {
      this.createAlert(
        AlertLevel.INFO,
        'scaling',
        `Queue scaled up: ${event.queueName} (${event.previousWorkers} → ${event.newWorkers})`,
        { event },
      );
    });

    this.eventEmitter.on('queue.scaled-down', (event) => {
      this.createAlert(
        AlertLevel.INFO,
        'scaling',
        `Queue scaled down: ${event.queueName} (${event.previousWorkers} → ${event.newWorkers})`,
        { event },
      );
    });

    // Circuit breaker events
    this.eventEmitter.on('circuit-breaker.opened', (data) => {
      this.createAlert(
        AlertLevel.CRITICAL,
        'fault-tolerance',
        `Circuit breaker OPENED for ${data.serviceId}`,
        data,
      );
    });

    this.eventEmitter.on('circuit-breaker.closed', (data) => {
      this.createAlert(
        AlertLevel.INFO,
        'fault-tolerance',
        `Circuit breaker CLOSED for ${data.serviceId}`,
        data,
      );
    });

    // Failover events
    this.eventEmitter.on('failover.target-unavailable', (data) => {
      this.createAlert(
        AlertLevel.WARNING,
        'fault-tolerance',
        `Failover target unavailable: ${data.targetId} for ${data.serviceId}`,
        data,
      );
    });

    // Duplicate message events
    this.eventEmitter.on('message.duplicate-detected', (data) => {
      this.createAlert(
        AlertLevel.INFO,
        'deduplication',
        `Duplicate message detected: ${data.messageId}`,
        data,
      );
    });
  }

  /**
   * Create an alert
   */
  createAlert(
    level: AlertLevel,
    component: string,
    message: string,
    metadata?: Record<string, any>,
  ): Alert {
    const alert: Alert = {
      id: `alert-${++this.alertIdCounter}`,
      level,
      component,
      message,
      timestamp: new Date(),
      metadata,
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 1000)
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Log based on level
    switch (level) {
      case AlertLevel.CRITICAL:
        this.logger.error(`[CRITICAL] ${component}: ${message}`);
        break;
      case AlertLevel.WARNING:
        this.logger.warn(`[WARNING] ${component}: ${message}`);
        break;
      case AlertLevel.INFO:
        this.logger.log(`[INFO] ${component}: ${message}`);
        break;
    }

    this.eventEmitter.emit('alert.created', alert);
    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.log(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all alerts
   */
  getAlerts(options?: {
    level?: AlertLevel;
    component?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Alert[] {
    let filtered = [...this.alerts];

    if (options?.level) {
      filtered = filtered.filter((a) => a.level === options.level);
    }

    if (options?.component) {
      filtered = filtered.filter((a) => a.component === options.component);
    }

    if (options?.acknowledged !== undefined) {
      filtered = filtered.filter(
        (a) => a.acknowledged === options.acknowledged,
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get unacknowledged alerts count
   */
  getUnacknowledgedAlertsCount(): number {
    return this.alerts.filter((a) => !a.acknowledged).length;
  }

  /**
   * Clear old alerts
   */
  @Cron(CronExpression.EVERY_HOUR)
  clearOldAlerts(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const beforeCount = this.alerts.length;

    this.alerts = this.alerts.filter((a) => a.timestamp.getTime() > cutoffTime);

    const removedCount = beforeCount - this.alerts.length;
    if (removedCount > 0) {
      this.logger.debug(`Cleared ${removedCount} old alerts`);
    }
  }

  /**
   * Collect system metrics
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  collectMetrics(): void {
    const metrics = {
      timestamp: new Date(),
      workers: this.workerManager.getWorkerStats(),
      loadBalancer: this.loadBalancer.getStats(),
      faultTolerance: this.faultTolerance.healthCheck(),
      deduplication: this.deduplication.getStats(),
      ordering: this.ordering.getStats(),
    };

    this.metricsHistory.push(metrics);

    // Keep only recent history (last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory.filter(
      (m) => m.timestamp.getTime() > cutoffTime,
    );

    // Check for threshold violations
    this.checkThresholds(metrics);
  }

  /**
   * Check metrics against thresholds
   */
  private checkThresholds(metrics: any): void {
    // Check worker health
    if (metrics.workers.unhealthy > 0) {
      this.createAlert(
        AlertLevel.WARNING,
        'workers',
        `${metrics.workers.unhealthy} unhealthy workers detected`,
        { unhealthyCount: metrics.workers.unhealthy },
      );
    }

    // Check worker load
    if (metrics.workers.averageLoadPercent > 90) {
      this.createAlert(
        AlertLevel.WARNING,
        'workers',
        `High worker load: ${metrics.workers.averageLoadPercent.toFixed(1)}%`,
        { loadPercent: metrics.workers.averageLoadPercent },
      );
    }

    // Check deduplication cache utilization
    if (metrics.deduplication.cacheUtilizationPercent > 90) {
      this.createAlert(
        AlertLevel.WARNING,
        'deduplication',
        `High deduplication cache utilization: ${metrics.deduplication.cacheUtilizationPercent.toFixed(1)}%`,
        { utilization: metrics.deduplication.cacheUtilizationPercent },
      );
    }

    // Check ordering partitions
    if (
      metrics.ordering.totalPartitions >
      this.config.ordering.maxPartitions * 0.9
    ) {
      this.createAlert(
        AlertLevel.WARNING,
        'ordering',
        `High partition count: ${metrics.ordering.totalPartitions}`,
        { partitions: metrics.ordering.totalPartitions },
      );
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealth {
    const workerStats = this.workerManager.getWorkerStats();
    const loadBalancerStats = this.loadBalancer.getStats();
    const faultToleranceHealth = this.faultTolerance.healthCheck();
    const deduplicationStats = this.deduplication.getStats();
    const orderingStats = this.ordering.getStats();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (workerStats.unhealthy > 0 || !faultToleranceHealth.healthy) {
      status = 'degraded';
    }

    if (workerStats.unhealthy > workerStats.total * 0.5) {
      status = 'critical';
    }

    const criticalAlerts = this.alerts.filter(
      (a) => a.level === AlertLevel.CRITICAL && !a.acknowledged,
    );
    if (criticalAlerts.length > 0) {
      status = 'critical';
    }

    return {
      status,
      components: {
        workers: {
          status: workerStats.unhealthy > 0 ? 'degraded' : 'healthy',
          details: workerStats,
        },
        loadBalancer: {
          status: 'healthy',
          details: loadBalancerStats,
        },
        faultTolerance: {
          status: faultToleranceHealth.healthy ? 'healthy' : 'degraded',
          details: faultToleranceHealth,
        },
        deduplication: {
          status: deduplicationStats.enabled ? 'healthy' : 'disabled',
          details: deduplicationStats,
        },
        ordering: {
          status: orderingStats.enabled ? 'healthy' : 'disabled',
          details: orderingStats,
        },
      },
      alerts: this.getAlerts({ acknowledged: false, limit: 10 }),
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): Array<any> {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return this.metricsHistory;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    totalAlerts: number;
    unacknowledgedAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    infoAlerts: number;
    metricsHistorySize: number;
  } {
    return {
      totalAlerts: this.alerts.length,
      unacknowledgedAlerts: this.getUnacknowledgedAlertsCount(),
      criticalAlerts: this.alerts.filter((a) => a.level === AlertLevel.CRITICAL)
        .length,
      warningAlerts: this.alerts.filter((a) => a.level === AlertLevel.WARNING)
        .length,
      infoAlerts: this.alerts.filter((a) => a.level === AlertLevel.INFO).length,
      metricsHistorySize: this.metricsHistory.length,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HorizontalScalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.logger.log('Monitoring configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): HorizontalScalingConfig {
    return { ...this.config };
  }
}
