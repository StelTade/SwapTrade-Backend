  readonly botTradesTotal = new Counter({
    name: 'bot_trades_total',
    help: 'Total number of trades executed by bots',
    labelNames: ['botId', 'asset', 'type'],
    registers: [this.registry],
  });
  recordBotTrade(botId: number, asset: string, type: string): void {
    this.botTradesTotal.labels(botId.toString(), asset, type).inc();
  }
import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  readonly dbQueryTotal = new Counter({
    name: 'db_query_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'success'],
    registers: [this.registry],
  });

  readonly dbQuerySlowTotal = new Counter({
    name: 'db_query_slow_total',
    help: 'Total number of slow database queries',
    labelNames: ['operation'],
    registers: [this.registry],
  });

  readonly dbQueryDurationSeconds = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds (slow queries)',
    labelNames: ['operation'],
    registers: [this.registry],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  readonly cacheRequestsTotal = new Counter({
    name: 'cache_requests_total',
    help: 'Total number of cache requests',
    labelNames: ['result'],
    registers: [this.registry],
  });

  readonly cacheHitRatio = new Gauge({
    name: 'cache_hit_ratio',
    help: 'Cache hit ratio (hits / (hits + misses))',
    registers: [this.registry],
  });

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    this.httpRequestsTotal.labels(method, route, status.toString()).inc();
    this.httpRequestDurationSeconds.labels(method, route, status.toString()).observe(durationSeconds);
  }

  recordDbQuery(operation: string, success: boolean): void {
    this.dbQueryTotal.labels(operation, success ? 'true' : 'false').inc();
  }

  recordSlowDbQuery(operation: string, durationMs: number): void {
    this.dbQuerySlowTotal.labels(operation).inc();
    this.dbQueryDurationSeconds.labels(operation).observe(durationMs / 1000);
  }

  recordCacheHit(): void {
    this.cacheHits += 1;
    this.cacheRequestsTotal.labels('hit').inc();
    this.updateCacheHitRatio();
  }

  recordCacheMiss(): void {
    this.cacheMisses += 1;
    this.cacheRequestsTotal.labels('miss').inc();
    this.updateCacheHitRatio();
  }

  recordCacheError(): void {
    this.cacheRequestsTotal.labels('error').inc();
  }

  recordCacheEviction(): void {
    this.cacheRequestsTotal.labels('eviction').inc();
  }

  private updateCacheHitRatio(): void {
    const total = this.cacheHits + this.cacheMisses;
    const ratio = total > 0 ? this.cacheHits / total : 0;
    this.cacheHitRatio.set(ratio);
  }
}
