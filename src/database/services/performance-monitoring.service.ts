import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MultiLevelCacheService } from './multi-level-cache.service';
import { DatabaseShardingService } from './database-sharding.service';
import { QueryOptimizationService } from './query-optimization.service';

export interface PerformanceMetrics {
  timestamp: Date;
  queryResponseTime: number;
  cacheHitRate: number;
  databaseConnections: number;
  activeTransactions: number;
  memoryUsage: number;
  cpuUsage: number;
  diskIO: number;
  errorRate: number;
  throughput: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: keyof PerformanceMetrics;
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // seconds
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: any;
}

export interface PerformanceReport {
  period: string;
  startTime: Date;
  endTime: Date;
  metrics: PerformanceMetrics[];
  alerts: Alert[];
  summary: {
    avgResponseTime: number;
    avgCacheHitRate: number;
    totalQueries: number;
    errorCount: number;
    uptime: number;
  };
}

@Injectable()
export class PerformanceMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private metrics: PerformanceMetrics[] = [];
  private alerts: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();
  private readonly maxMetricsRetention = 10000; // Keep last 10k metrics

  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: MultiLevelCacheService,
    private readonly shardingService: DatabaseShardingService,
    private readonly queryOptimization: QueryOptimizationService,
  ) {}

  async onModuleInit() {
    this.initializeDefaultAlertRules();
    this.logger.log('Performance monitoring service initialized');
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'slow_query_response',
        name: 'Slow Query Response Time',
        metric: 'queryResponseTime',
        operator: '>',
        threshold: 1000, // 1 second
        duration: 60, // 1 minute
        severity: 'high',
        enabled: true,
        cooldown: 300, // 5 minutes
      },
      {
        id: 'low_cache_hit_rate',
        name: 'Low Cache Hit Rate',
        metric: 'cacheHitRate',
        operator: '<',
        threshold: 80, // 80%
        duration: 300, // 5 minutes
        severity: 'medium',
        enabled: true,
        cooldown: 600, // 10 minutes
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: '>',
        threshold: 5, // 5%
        duration: 60, // 1 minute
        severity: 'critical',
        enabled: true,
        cooldown: 180, // 3 minutes
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'memoryUsage',
        operator: '>',
        threshold: 80, // 80%
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        cooldown: 600, // 10 minutes
      },
      {
        id: 'database_connection_exhaustion',
        name: 'Database Connection Pool Exhaustion',
        metric: 'databaseConnections',
        operator: '>',
        threshold: 90, // 90% of max connections
        duration: 30, // 30 seconds
        severity: 'critical',
        enabled: true,
        cooldown: 120, // 2 minutes
      },
    ];

    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule);
    });

    this.logger.log(`Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Collect performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      // Get database metrics
      const dbMetrics = await this.getDatabaseMetrics();

      // Get cache metrics
      const cacheMetrics = this.cacheService.getMetrics();

      // Get system metrics (simplified)
      const systemMetrics = await this.getSystemMetrics();

      // Get shard health if available
      const shardHealth = await this.getShardHealth();

      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        queryResponseTime: dbMetrics.avgQueryTime,
        cacheHitRate: cacheMetrics.overallHitRate,
        databaseConnections: dbMetrics.activeConnections,
        activeTransactions: dbMetrics.activeTransactions,
        memoryUsage: systemMetrics.memoryUsage,
        cpuUsage: systemMetrics.cpuUsage,
        diskIO: systemMetrics.diskIO,
        errorRate: dbMetrics.errorRate,
        throughput: dbMetrics.queriesPerSecond,
      };

      // Store metrics
      this.metrics.push(metrics);
      if (this.metrics.length > this.maxMetricsRetention) {
        this.metrics.shift();
      }

      // Check alert rules
      await this.checkAlertRules(metrics);

      const collectionTime = Date.now() - startTime;
      this.logger.debug(`Metrics collected in ${collectionTime}ms`);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
      throw error;
    }
  }

  /**
   * Check alert rules against current metrics
   */
  async checkAlertRules(metrics: PerformanceMetrics): Promise<void> {
    const now = new Date();

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const cooldownEnd = this.alertCooldowns.get(ruleId);
      if (cooldownEnd && now < cooldownEnd) continue;

      // Check if rule is triggered
      const metricValue = metrics[rule.metric] as number;
      const isTriggered = this.evaluateCondition(
        metricValue,
        rule.operator,
        rule.threshold,
      );

      if (isTriggered) {
        // Check if condition has been met for the required duration
        const recentMetrics = this.metrics.filter(
          (m) => m.timestamp >= new Date(now.getTime() - rule.duration * 1000),
        );

        const allTriggered = recentMetrics.every((m) =>
          this.evaluateCondition(
            m[rule.metric] as number,
            rule.operator,
            rule.threshold,
          ),
        );

        if (allTriggered && recentMetrics.length > 0) {
          await this.triggerAlert(rule, metrics);

          // Set cooldown
          this.alertCooldowns.set(
            ruleId,
            new Date(now.getTime() + rule.cooldown * 1000),
          );
        }
      }
    }
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(
    rule: AlertRule,
    metrics: PerformanceMetrics,
  ): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      message: `${rule.name}: ${rule.metric} is ${metrics[rule.metric]} ${rule.operator} ${rule.threshold}`,
      severity: rule.severity,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule,
        currentMetrics: metrics,
      },
    };

    this.alerts.push(alert);
    this.logger.warn(`ALERT: ${alert.message}`);

    // Send notifications (implement based on your notification system)
    await this.sendAlertNotification(alert);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Get metrics for a time range
   */
  getMetricsInRange(startTime: Date, endTime: Date): PerformanceMetrics[] {
    return this.metrics.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime,
    );
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return this.alerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.logger.log(`Alert resolved: ${alert.message}`);
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(
    period: 'hour' | 'day' | 'week' = 'hour',
  ): PerformanceReport {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const periodMetrics = this.getMetricsInRange(startTime, now);
    const periodAlerts = this.alerts.filter((a) => a.timestamp >= startTime);

    const summary = {
      avgResponseTime: this.calculateAverage(
        periodMetrics,
        'queryResponseTime',
      ),
      avgCacheHitRate: this.calculateAverage(periodMetrics, 'cacheHitRate'),
      totalQueries: periodMetrics.reduce((sum, m) => sum + m.throughput, 0),
      errorCount: periodAlerts.filter((a) => a.severity === 'critical').length,
      uptime: this.calculateUptime(periodMetrics),
    };

    return {
      period,
      startTime,
      endTime: now,
      metrics: periodMetrics,
      alerts: periodAlerts,
      summary,
    };
  }

  /**
   * Cron job to collect metrics every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectMetricsCron(): Promise<void> {
    try {
      await this.collectMetrics();
    } catch (error) {
      this.logger.error('Failed to collect metrics in cron job:', error);
    }
  }

  /**
   * Cron job to generate hourly reports
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateHourlyReport(): Promise<void> {
    try {
      const report = this.generatePerformanceReport('hour');
      this.logger.log(
        `Hourly performance report generated: ${JSON.stringify(report.summary)}`,
      );

      // Store report for historical analysis
      await this.storePerformanceReport(report);
    } catch (error) {
      this.logger.error('Failed to generate hourly report:', error);
    }
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.log(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      this.alertRules.delete(ruleId);
      this.logger.log(`Removed alert rule: ${rule.name}`);
    }
  }

  /**
   * Get database-specific metrics
   */
  private async getDatabaseMetrics(): Promise<any> {
    try {
      // Test query performance
      const testQueryStart = Date.now();
      await this.dataSource.query('SELECT 1');
      const testQueryTime = Date.now() - testQueryStart;

      // Get connection info (simplified for SQLite)
      const connectionInfo = {
        activeConnections: 1, // SQLite doesn't have connection pooling
        avgQueryTime: testQueryTime,
        activeTransactions: 0,
        errorRate: 0,
        queriesPerSecond: this.calculateRecentQPS(),
      };

      return connectionInfo;
    } catch (error) {
      this.logger.error('Failed to get database metrics:', error);
      return {
        activeConnections: 0,
        avgQueryTime: 0,
        activeTransactions: 0,
        errorRate: 100,
        queriesPerSecond: 0,
      };
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<any> {
    // Simplified system metrics
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;

    return {
      memoryUsage: (usedMem / totalMem) * 100,
      cpuUsage: 0, // Would need a library like 'os-utils' for real CPU usage
      diskIO: 0, // Would need platform-specific implementation
    };
  }

  /**
   * Get shard health metrics
   */
  async getShardHealth(): Promise<any> {
    try {
      const shardHealth = await this.shardingService.getShardHealth();
      const healthyShards = Object.values(shardHealth).filter(
        (h: any) => h.status === 'healthy',
      ).length;
      const totalShards = Object.keys(shardHealth).length;

      return {
        healthyShards,
        totalShards,
        shardHealthRatio:
          totalShards > 0 ? (healthyShards / totalShards) * 100 : 0,
      };
    } catch (error) {
      return {
        healthyShards: 0,
        totalShards: 0,
        shardHealthRatio: 0,
      };
    }
  }

  /**
   * Calculate recent queries per second
   */
  private calculateRecentQPS(): number {
    const recentMetrics = this.metrics.slice(-10); // Last 10 metrics
    if (recentMetrics.length < 2) return 0;

    const timeSpan =
      (recentMetrics[recentMetrics.length - 1].timestamp.getTime() -
        recentMetrics[0].timestamp.getTime()) /
      1000;

    if (timeSpan === 0) return 0;

    const totalQueries = recentMetrics.reduce(
      (sum, m) => sum + m.throughput,
      0,
    );
    return totalQueries / timeSpan;
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '=':
        return value === threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * Calculate average of a metric across multiple data points
   */
  private calculateAverage(
    metrics: PerformanceMetrics[],
    field: keyof PerformanceMetrics,
  ): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m[field] as number), 0);
    return sum / metrics.length;
  }

  /**
   * Calculate uptime based on successful metric collections
   */
  private calculateUptime(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    // Simplified uptime calculation
    const expectedCollections = Math.floor(
      (Date.now() - metrics[0].timestamp.getTime()) / 30000, // 30 second intervals
    );

    return expectedCollections > 0
      ? (metrics.length / expectedCollections) * 100
      : 100;
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: Alert): Promise<void> {
    // Implement your notification logic here
    // Could be email, Slack, webhook, etc.
    this.logger.warn(`Alert notification sent: ${alert.message}`);
  }

  /**
   * Store performance report for historical analysis
   */
  private async storePerformanceReport(
    report: PerformanceReport,
  ): Promise<void> {
    // Implement storage logic (database, file system, etc.)
    this.logger.log(`Performance report stored for period: ${report.period}`);
  }
}
