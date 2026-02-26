// src/common/logging/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger_service';

export interface MetricSnapshot {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
}

export interface ErrorRateSnapshot {
  total: number;
  errors: number;
  rate: number;
}

@Injectable()
export class MetricsService {
  private requestDurations: Map<string, number[]> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private queryDurations: Map<string, number[]> = new Map();
  private readonly windowSize = 60000; // 1 minute window
  private readonly alertThreshold = 0.01; // 1% error rate
  private lastAlertTime: Map<string, number> = new Map();
  private readonly alertCooldown = 300000; // 5 minutes

  constructor(private readonly logger: LoggerService) {
    // Clean up old metrics every minute
    setInterval(() => this.cleanupMetrics(), this.windowSize);
    
    // Check error rates every 10 seconds
    setInterval(() => this.checkErrorRates(), 10000);
  }

  recordRequestDuration(route: string, duration: number): void {
    const key = `request:${route}`;
    
    if (!this.requestDurations.has(key)) {
      this.requestDurations.set(key, []);
    }
    
    this.requestDurations.get(key)!.push(duration);
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    this.logger.metric('http.request.duration', duration, {
      route,
    });
  }

  recordError(route: string, statusCode: number): void {
    const key = `request:${route}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    this.logger.metric('http.request.error', 1, {
      route,
      statusCode: statusCode.toString(),
    });
  }

  recordQueryDuration(query: string, duration: number): void {
    const key = `query:${query}`;
    
    if (!this.queryDurations.has(key)) {
      this.queryDurations.set(key, []);
    }
    
    this.queryDurations.get(key)!.push(duration);

    this.logger.metric('db.query.duration', duration, {
      query,
    });

    // Alert on slow queries (> 100ms)
    if (duration > 100) {
      this.logger.warn('Slow database query detected', {
        query,
        duration,
      });
    }
  }

  getRequestMetrics(route: string): MetricSnapshot | null {
    const key = `request:${route}`;
    const durations = this.requestDurations.get(key);

    if (!durations || durations.length === 0) {
      return null;
    }

    return this.calculateSnapshot(durations);
  }

  getQueryMetrics(query: string): MetricSnapshot | null {
    const key = `query:${query}`;
    const durations = this.queryDurations.get(key);

    if (!durations || durations.length === 0) {
      return null;
    }

    return this.calculateSnapshot(durations);
  }

  getErrorRate(route: string): ErrorRateSnapshot {
    const key = `request:${route}`;
    const total = this.requestCounts.get(key) || 0;
    const errors = this.errorCounts.get(key) || 0;
    const rate = total > 0 ? errors / total : 0;

    return { total, errors, rate };
  }

  getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {
      requests: {},
      queries: {},
      errorRates: {},
    };

    // Collect request metrics
    for (const [key, durations] of this.requestDurations.entries()) {
      const route = key.replace('request:', '');
      metrics.requests[route] = {
        ...this.calculateSnapshot(durations),
        count: this.requestCounts.get(key) || 0,
        errorRate: this.getErrorRate(route),
      };
    }

    // Collect query metrics
    for (const [key, durations] of this.queryDurations.entries()) {
      const query = key.replace('query:', '');
      metrics.queries[query] = this.calculateSnapshot(durations);
    }

    return metrics;
  }

  private calculateSnapshot(values: number[]): MetricSnapshot {
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = sum / count;

    return { count, sum, min, max, avg };
  }

  private cleanupMetrics(): void {
    const now = Date.now();
    
    // Keep only last 1000 entries per metric
    for (const [key, durations] of this.requestDurations.entries()) {
      if (durations.length > 1000) {
        this.requestDurations.set(key, durations.slice(-1000));
      }
    }

    for (const [key, durations] of this.queryDurations.entries()) {
      if (durations.length > 1000) {
        this.queryDurations.set(key, durations.slice(-1000));
      }
    }
  }

  private checkErrorRates(): void {
    const now = Date.now();

    for (const [key] of this.requestCounts.entries()) {
      const route = key.replace('request:', '');
      const errorRate = this.getErrorRate(route);

      // Alert if error rate exceeds threshold
      if (errorRate.rate > this.alertThreshold && errorRate.total >= 10) {
        const lastAlert = this.lastAlertTime.get(route) || 0;
        
        // Only alert if cooldown period has passed
        if (now - lastAlert > this.alertCooldown) {
          this.logger.error('High error rate detected', undefined, {
            route,
            errorRate: `${(errorRate.rate * 100).toFixed(2)}%`,
            total: errorRate.total,
            errors: errorRate.errors,
          });

          this.lastAlertTime.set(route, now);
        }
      }
    }
  }

  reset(): void {
    this.requestDurations.clear();
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.queryDurations.clear();
    this.lastAlertTime.clear();
  }
}