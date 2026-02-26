import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Redis } from 'ioredis';
import { CacheDependencyGraphService } from './cache-dependency-graph.service';
import { CacheMetricsService } from './cache-metrics.service';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly dependencyGraph: CacheDependencyGraphService,
    private readonly metricsService: CacheMetricsService,
  ) {}

  /**
   * Invalidate a specific cache key and all its dependents
   */
  async invalidate(key: string, entityType = 'unknown'): Promise<void> {
    const patterns = this.dependencyGraph.getInvalidationPatterns(key);
    this.logger.debug(
      `Invalidating key "${key}" + ${patterns.length - 1} dependents`,
    );

    await Promise.allSettled(
      patterns.map((pattern) => this.invalidateByPattern(pattern, entityType)),
    );
  }

  /**
   * Invalidate all keys matching a glob pattern.
   * Supports both Redis SCAN (production) and simple key-del fallback.
   */
  async invalidateByPattern(
    pattern: string,
    entityType = 'unknown',
  ): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;
      const client: Redis | undefined = store?.getClient?.() ?? store?.client;

      if (client && typeof client.scan === 'function') {
        // Redis path: efficient SCAN-based deletion
        await this.redisPatternDelete(client, pattern);
      } else {
        // Fallback: try direct key deletion (exact match)
        await this.cacheManager.del(pattern);
      }

      this.metricsService.recordInvalidation(entityType);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate pattern "${pattern}": ${err.message}`,
      );
    }
  }

  /**
   * Batch invalidate multiple keys (used by transaction hooks)
   */
  async invalidateBatch(
    keys: string[],
    entityType = 'unknown',
  ): Promise<void> {
    await Promise.allSettled(
      keys.map((k) => this.invalidate(k, entityType)),
    );
  }

  /**
   * Build a concrete key from a template, substituting {{param}} placeholders.
   * e.g. buildKey('user:balance:{{userId}}', { userId: '123' }) → 'user:balance:123'
   */
  buildKey(template: string, params: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(params[name] ?? '*'),
    );
  }

  private async redisPatternDelete(
    client: Redis,
    pattern: string,
  ): Promise<void> {
    // Convert glob pattern (* → Redis glob *)
    const redisPattern = pattern.includes('*') ? pattern : `${pattern}*`;
    let cursor = '0';
    const pipeline = client.pipeline();
    let deleteCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        redisPattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        pipeline.del(key);
        deleteCount++;
      }
    } while (cursor !== '0');

    if (deleteCount > 0) {
      await pipeline.exec();
      this.logger.debug(
        `Deleted ${deleteCount} keys matching "${redisPattern}"`,
      );
    }
  }
}