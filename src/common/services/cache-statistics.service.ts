import { Injectable, Logger, Optional } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';

export interface CacheStatistics {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRatio: number;
  errorsByType: Record<string, number>;
  keyStats: Record<string, { hits: number; misses: number; errors: number }>;
  lastUpdated: Date;
}

/**
 * Service to track cache performance metrics and statistics
 */
@Injectable()
export class CacheStatisticsService {
  private readonly logger = new Logger(CacheStatisticsService.name);
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalRequests: 0,
    hitRatio: 0,
    errorsByType: {},
    keyStats: {},
    lastUpdated: new Date(),
  };

  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  /**
   * Record a cache hit
   */
  recordHit(key: string): void {
    this.stats.hits++;
    this.stats.totalRequests++;
    this.updateKeyStats(key, 'hits');
    this.updateHitRatio();
    this.metricsService?.recordCacheHit();
  }

  /**
   * Record a cache miss
   */
  recordMiss(key: string): void {
    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateKeyStats(key, 'misses');
    this.updateHitRatio();
    this.metricsService?.recordCacheMiss();
  }

  /**
   * Record a cache error
   */
  recordError(key: string, errorType: 'read' | 'write' | 'execution'): void {
    this.stats.errors++;
    this.stats.errorsByType[errorType] =
      (this.stats.errorsByType[errorType] || 0) + 1;
    this.updateKeyStats(key, 'errors');
    this.metricsService?.recordCacheError();
  }

  /**
   * Record cache invalidation
   */
  recordInvalidation(key: string): void {
    this.logger.debug(`Cache invalidated: ${key}`);
    if (this.stats.keyStats[key]) {
      this.stats.keyStats[key].hits = 0;
      this.stats.keyStats[key].misses = 0;
    }
    this.metricsService?.recordCacheEviction();
  }

  /**
   * Get current cache statistics
   */
  getStatistics(): CacheStatistics {
    return {
      ...this.stats,
      lastUpdated: new Date(),
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      hitRatio: 0,
      errorsByType: {},
      keyStats: {},
      lastUpdated: new Date(),
    };
    this.logger.log('Cache statistics reset');
  }

  /**
   * Get statistics for a specific cache key
   */
  getKeyStatistics(key: string) {
    return (
      this.stats.keyStats[key] || {
        hits: 0,
        misses: 0,
        errors: 0,
      }
    );
  }

  /**
   * Get top cache keys by hit count
   */
  getTopCacheKeys(limit = 10) {
    return Object.entries(this.stats.keyStats)
      .sort(([, a], [, b]) => b.hits - a.hits)
      .slice(0, limit)
      .map(([key, stats]) => ({
        key,
        ...stats,
        hitRatio: stats.hits / (stats.hits + stats.misses) || 0,
      }));
  }

  /**
   * Private helper to update per-key statistics
   */
  private updateKeyStats(
    key: string,
    type: 'hits' | 'misses' | 'errors',
  ): void {
    if (!this.stats.keyStats[key]) {
      this.stats.keyStats[key] = { hits: 0, misses: 0, errors: 0 };
    }
    this.stats.keyStats[key][type]++;
  }

  /**
   * Private helper to update overall hit ratio
   */
  private updateHitRatio(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = total > 0 ? this.stats.hits / total : 0;
  }
}
