import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, Summary, Registry } from 'prom-client';
import { MetricDefinition, MetricType, BusinessMetrics } from '../interfaces/monitoring.interfaces';

@Injectable()
export class PrometheusService implements OnModuleInit, OnModuleDestroy {
  private registry: Registry;
  private metrics: Map<string, Counter | Histogram | Gauge | Summary> = new Map();
  private businessMetricsCache: BusinessMetrics;

  constructor() {
    this.registry = new Registry();
    this.businessMetricsCache = {
      tradesPerSecond: 0,
      totalVolume: 0,
      activeUsers: 0,
      portfolioValue: 0,
      orderBookDepth: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      errorRate: 0,
      throughput: 0
    };
  }

  async onModuleInit() {
    // Collect default Node.js metrics
    register.setDefaultLabels({
      app: 'swaptrade-backend',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

    // Initialize default metrics
    this.initializeDefaultMetrics();
    
    // Initialize business metrics
    this.initializeBusinessMetrics();
  }

  async onModuleDestroy() {
    // Clean up metrics registry
    this.registry.clear();
  }

  private initializeDefaultMetrics() {
    // HTTP request counter
    this.createCounter({
      name: 'http_requests_total',
      type: MetricType.COUNTER,
      description: 'Total number of HTTP requests',
      labels: ['method', 'route', 'status_code']
    });

    // HTTP request duration histogram
    this.createHistogram({
      name: 'http_request_duration_seconds',
      type: MetricType.HISTOGRAM,
      description: 'HTTP request duration in seconds',
      labels: ['method', 'route'],
      unit: 'seconds'
    });

    // Database query counter
    this.createCounter({
      name: 'database_queries_total',
      type: MetricType.COUNTER,
      description: 'Total number of database queries',
      labels: ['operation', 'table', 'status']
    });

    // Database query duration
    this.createHistogram({
      name: 'database_query_duration_seconds',
      type: MetricType.HISTOGRAM,
      description: 'Database query duration in seconds',
      labels: ['operation', 'table'],
      unit: 'seconds'
    });

    // Active connections gauge
    this.createGauge({
      name: 'active_connections',
      type: MetricType.GAUGE,
      description: 'Number of active connections',
      labels: ['type']
    });

    // Error rate counter
    this.createCounter({
      name: 'errors_total',
      type: MetricType.COUNTER,
      description: 'Total number of errors',
      labels: ['type', 'severity']
    });
  }

  private initializeBusinessMetrics() {
    // Trades per second
    this.createHistogram({
      name: 'trades_per_second',
      type: MetricType.HISTOGRAM,
      description: 'Number of trades processed per second',
      labels: ['asset', 'type'],
      unit: 'trades'
    });

    // Trading volume
    this.createCounter({
      name: 'trading_volume_total',
      type: MetricType.COUNTER,
      description: 'Total trading volume',
      labels: ['asset', 'currency'],
      unit: 'currency_units'
    });

    // Active users
    this.createGauge({
      name: 'active_users_total',
      type: MetricType.GAUGE,
      description: 'Number of currently active users',
      labels: ['session_type']
    });

    // Portfolio value
    this.createGauge({
      name: 'portfolio_value',
      type: MetricType.GAUGE,
      description: 'Total portfolio value',
      labels: ['user_id', 'currency'],
      unit: 'currency_units'
    });

    // Order book depth
    this.createGauge({
      name: 'order_book_depth',
      type: MetricType.GAUGE,
      description: 'Order book depth',
      labels: ['asset', 'side'],
      unit: 'orders'
    });

    // Queue metrics
    this.createGauge({
      name: 'queue_size',
      type: MetricType.GAUGE,
      description: 'Queue size',
      labels: ['queue_name', 'priority']
    });

    this.createHistogram({
      name: 'queue_processing_time_seconds',
      type: MetricType.HISTOGRAM,
      description: 'Queue processing time',
      labels: ['queue_name'],
      unit: 'seconds'
    });

    // Fee progression metrics
    this.createCounter({
      name: 'fee_discounts_applied_total',
      type: MetricType.COUNTER,
      description: 'Total number of fee discounts applied',
      labels: ['achievement_category', 'tier']
    });

    this.createHistogram({
      name: 'effective_fee_rate_bps',
      type: MetricType.HISTOGRAM,
      description: 'Effective fee rate in basis points',
      labels: ['tier', 'asset'],
      unit: 'basis_points'
    });

    // Referral system metrics
    this.createCounter({
      name: 'referrals_total',
      type: MetricType.COUNTER,
      description: 'Total number of referrals',
      labels: ['tier', 'status']
    });

    this.createCounter({
      name: 'commission_distributed_total',
      type: MetricType.COUNTER,
      description: 'Total commission distributed',
      labels: ['tier', 'currency'],
      unit: 'currency_units'
    });
  }

  // Metric creation methods
  createCounter(definition: MetricDefinition): Counter {
    const counter = new Counter({
      name: definition.name,
      help: definition.description,
      labelNames: definition.labels || [],
      registers: [this.registry]
    });

    this.metrics.set(definition.name, counter);
    return counter;
  }

  createHistogram(definition: MetricDefinition): Histogram {
    const histogram = new Histogram({
      name: definition.name,
      help: definition.description,
      labelNames: definition.labels || [],
      buckets: this.getDefaultBuckets(),
      registers: [this.registry]
    });

    this.metrics.set(definition.name, histogram);
    return histogram;
  }

  createGauge(definition: MetricDefinition): Gauge {
    const gauge = new Gauge({
      name: definition.name,
      help: definition.description,
      labelNames: definition.labels || [],
      registers: [this.registry]
    });

    this.metrics.set(definition.name, gauge);
    return gauge;
  }

  createSummary(definition: MetricDefinition): Summary {
    const summary = new Summary({
      name: definition.name,
      help: definition.description,
      labelNames: definition.labels || [],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry]
    });

    this.metrics.set(definition.name, summary);
    return summary;
  }

  private getDefaultBuckets(): number[] {
    return [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10];
  }

  // Metric recording methods
  incrementCounter(name: string, labels?: Record<string, string>, value?: number): void {
    const metric = this.metrics.get(name) as Counter;
    if (metric) {
      if (labels) {
        metric.inc(labels, value || 1);
      } else {
        metric.inc(value || 1);
      }
    }
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name) as Histogram;
    if (metric) {
      if (labels) {
        metric.observe(labels, value);
      } else {
        metric.observe(value);
      }
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name) as Gauge;
    if (metric) {
      if (labels) {
        metric.set(labels, value);
      } else {
        metric.set(value);
      }
    }
  }

  recordSummary(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name) as Summary;
    if (metric) {
      if (labels) {
        metric.observe(labels, value);
      } else {
        metric.observe(value);
      }
    }
  }

  // HTTP metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.incrementCounter('http_requests_total', {
      method,
      route,
      status_code: statusCode.toString()
    });

    this.recordHistogram('http_request_duration_seconds', duration / 1000, {
      method,
      route
    });

    if (statusCode >= 400) {
      this.incrementCounter('errors_total', {
        type: 'http',
        severity: statusCode >= 500 ? 'high' : 'medium'
      });
    }
  }

  // Database metrics
  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
    this.incrementCounter('database_queries_total', {
      operation,
      table,
      status: success ? 'success' : 'error'
    });

    this.recordHistogram('database_query_duration_seconds', duration / 1000, {
      operation,
      table
    });

    if (!success) {
      this.incrementCounter('errors_total', {
        type: 'database',
        severity: 'high'
      });
    }
  }

  // Business metrics
  recordTrade(asset: string, type: string, volume: number, feeRate: number): void {
    this.incrementCounter('trading_volume_total', {
      asset,
      currency: 'XLM'
    }, volume);

    this.recordHistogram('effective_fee_rate_bps', feeRate, {
      tier: 'current',
      asset
    });

    // Update trades per second (would need time window calculation)
    this.recordHistogram('trades_per_second', 1, {
      asset,
      type
    });
  }

  updateActiveUsers(count: number, sessionType: string = 'active'): void {
    this.setGauge('active_users_total', count, {
      session_type: sessionType
    });
  }

  updatePortfolioValue(userId: string, value: number, currency: string = 'XLM'): void {
    this.setGauge('portfolio_value', value, {
      user_id: userId,
      currency
    });
  }

  updateOrderBookDepth(asset: string, side: string, depth: number): void {
    this.setGauge('order_book_depth', depth, {
      asset,
      side
    });
  }

  // Queue metrics
  updateQueueSize(queueName: string, size: number, priority: string = 'normal'): void {
    this.setGauge('queue_size', size, {
      queue_name: queueName,
      priority
    });
  }

  recordQueueProcessingTime(queueName: string, duration: number): void {
    this.recordHistogram('queue_processing_time_seconds', duration / 1000, {
      queue_name: queueName
    });
  }

  // Fee progression metrics
  recordFeeDiscountApplied(category: string, tier: string): void {
    this.incrementCounter('fee_discounts_applied_total', {
      achievement_category: category,
      tier
    });
  }

  // Referral metrics
  recordReferral(tier: string, status: string): void {
    this.incrementCounter('referrals_total', {
      tier,
      status
    });
  }

  recordCommissionDistributed(tier: string, amount: number, currency: string = 'XLM'): void {
    this.incrementCounter('commission_distributed_total', {
      tier,
      currency
    }, amount);
  }

  // Get metrics for monitoring
  getMetrics(): string {
    return this.registry.metrics();
  }

  getBusinessMetrics(): BusinessMetrics {
    return this.businessMetricsCache;
  }

  updateBusinessMetrics(metrics: Partial<BusinessMetrics>): void {
    this.businessMetricsCache = { ...this.businessMetricsCache, ...metrics };
  }

  // Health check metrics
  recordHealthCheck(check: string, status: 'pass' | 'warn' | 'fail', duration: number): void {
    this.incrementCounter('health_checks_total', {
      check,
      status
    });

    this.recordHistogram('health_check_duration_seconds', duration / 1000, {
      check
    });
  }

  // Custom metrics for specific business logic
  recordUserAction(action: string, userId?: string, metadata?: Record<string, string>): void {
    const labels = { action, ...metadata };
    if (userId) {
      labels['user_id'] = userId;
    }

    this.incrementCounter('user_actions_total', labels);
  }

  recordSystemResource(resource: string, usage: number, unit: string): void {
    this.setGauge(`system_${resource}_usage`, usage, {
      unit
    });
  }

  recordCacheHit(cacheName: string, hit: boolean): void {
    this.incrementCounter('cache_operations_total', {
      cache: cacheName,
      operation: hit ? 'hit' : 'miss'
    });
  }

  recordRateLimit(userId: string, endpoint: string, allowed: boolean): void {
    this.incrementCounter('rate_limit_checks_total', {
      user_id: userId,
      endpoint,
      result: allowed ? 'allowed' : 'blocked'
    });
  }
}
