import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Redis } from 'ioredis';
import { CacheHitMissMetrics } from '../cache/interfaces/cache-warming.interface';
import { MetricsService } from '../../metrics/metrics.service';
import { CacheDependencyGraphService } from '../cache/cache-dependency-graph.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // ── In-memory hit/miss counters (existing) ────────────────────────────────
  private hits = 0;
  private misses = 0;
  private warmedHits = 0;
  private warmedMisses = 0;

  // ── Per-entity-type invalidation counter (new) ────────────────────────────
  private invalidations = new Map<string, number>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly metricsService?: MetricsService,
    @Optional() private readonly dependencyGraph?: CacheDependencyGraphService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Core get / set / del  (existing interface preserved)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get value from cache.
   * Tracks hit/miss metrics for both global and warmed-key buckets.
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);

      if (value !== undefined && value !== null) {
        this.hits++;
        this.metricsService?.recordCacheHit();
        if (this.isWarmedCacheKey(key)) this.warmedHits++;
      } else {
        this.misses++;
        this.metricsService?.recordCacheMiss();
        if (this.isWarmedCacheKey(key)) this.warmedMisses++;
      }

      return value ?? undefined;
    } catch (err) {
      this.logger.warn(`Cache get failed for "${key}": ${err.message}`);
      this.misses++;
      return undefined;
    }
  }

  /**
   * Set value in cache with optional TTL (seconds).
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, (ttl ?? 30) * 1000);
    } catch (err) {
      this.logger.warn(`Cache set failed for "${key}": ${err.message}`);
    }
  }

  /**
   * Delete a single cache key.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.metricsService?.recordCacheEviction();
    } catch (err) {
      this.logger.warn(`Cache del failed for "${key}": ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pattern-based invalidation  (upgraded from stub)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Invalidate all keys matching a Redis glob pattern.
   *
   * Previously this was a no-op stub. Now it uses SCAN + pipeline DEL when
   * a real Redis client is available, and falls back to exact-key deletion
   * for in-memory stores (e.g. in tests).
   *
   * @param pattern   Redis glob, e.g. "user_balances:*" or "portfolio:123"
   * @param entityType  Optional label for invalidation metrics
   */
  async invalidate(pattern: string, entityType = 'unknown'): Promise<void> {
    try {
      const client = this.getRedisClient();

      if (client) {
        await this.redisPatternDelete(client, pattern);
      } else {
        // Fallback: treat pattern as exact key (works for tests / local store)
        await this.cacheManager.del(pattern);
      }

      this.trackInvalidation(entityType);
      this.metricsService?.recordCacheEviction();
    } catch (err) {
      this.logger.warn(`Pattern invalidation failed for "${pattern}": ${err.message}`);
    }
  }

  /**
   * Invalidate an exact list of cache keys.
   * Cascades through the dependency graph when one is registered.
   *
   * @param keys        Exact cache keys to delete
   * @param entityType  Optional label for invalidation metrics
   */
  async invalidateKeys(keys: string[], entityType = 'unknown'): Promise<void> {
    // Expand each key through the dependency graph (if available)
    const expanded = this.dependencyGraph
      ? this.expandWithDependencies(keys)
      : keys;

    await Promise.allSettled(
      expanded.map((key) => this.del(key)),
    );

    this.trackInvalidation(entityType, expanded.length);
  }

  /**
   * Build a concrete cache key from a template by substituting {{param}} tokens.
   *
   * @example
   * buildKey('user_balances:{{userId}}', { userId: '42' }) // → 'user_balances:42'
   */
  buildKey(template: string, params: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(params[name] ?? '*'),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Domain helpers — Balance  (existing, now internally use invalidate())
  // ──────────────────────────────────────────────────────────────────────────

  async setUserBalanceCache(userId: string, balances: any): Promise<void> {
    await this.set(`user_balances:${userId}`, balances, 30);
  }

  async getUserBalanceCache(userId: string): Promise<any | undefined> {
    return this.get(`user_balances:${userId}`);
  }

  async invalidateUserBalanceCache(userId: string): Promise<void> {
    await this.del(`user_balances:${userId}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Domain helpers — Market prices  (existing)
  // ──────────────────────────────────────────────────────────────────────────

  async setMarketPriceCache(asset: string, price: any): Promise<void> {
    await this.set(`market_price:${asset}`, price, 300);
  }

  async getMarketPriceCache(asset: string): Promise<any | undefined> {
    return this.get(`market_price:${asset}`);
  }

  async invalidateMarketPriceCache(asset: string): Promise<void> {
    await this.del(`market_price:${asset}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Domain helpers — Portfolio  (existing)
  // ──────────────────────────────────────────────────────────────────────────

  async setPortfolioCache(userId: string, portfolio: any): Promise<void> {
    await this.set(`portfolio:${userId}`, portfolio, 60);
  }

  async getPortfolioCache(userId: string): Promise<any | undefined> {
    return this.get(`portfolio:${userId}`);
  }

  async invalidatePortfolioCache(userId: string): Promise<void> {
    await this.del(`portfolio:${userId}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Compound invalidation helpers  (existing, now with cascade support)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Invalidate all balance-related caches for a user.
   * Also triggers dependency-graph cascades (e.g. portfolio).
   */
  async invalidateBalanceRelatedCaches(userId: string): Promise<void> {
    await this.invalidateKeys(
      [`user_balances:${userId}`, `portfolio:${userId}`],
      'Balance',
    );
  }

  /**
   * Invalidate all trade-related caches after a trade is executed.
   */
  async invalidateTradeRelatedCaches(userId: string, asset: string): Promise<void> {
    await this.invalidateKeys(
      [
        `user_balances:${userId}`,
        `portfolio:${userId}`,
        `market_price:${asset}`,
      ],
      'Trade',
    );
  }

  /**
   * Invalidate all bid-related caches after a bid is created.
   */
  async invalidateBidRelatedCaches(userId: string, asset: string): Promise<void> {
    await this.invalidateKeys(
      [`user_balances:${userId}`, `portfolio:${userId}`],
      'Bid',
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Metrics  (existing interface extended with invalidation counts)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns hit/miss metrics.
   * Shape is backward-compatible with the existing CacheHitMissMetrics interface.
   * The optional `invalidationsByEntity` field is additive.
   */
  getCacheMetrics(): CacheHitMissMetrics & { invalidationsByEntity: Record<string, number> } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    const warmedTotal = this.warmedHits + this.warmedMisses;
    const warmedHitRate = warmedTotal > 0
      ? (this.warmedHits / warmedTotal) * 100
      : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      warmedHits: this.warmedHits,
      warmedMisses: this.warmedMisses,
      warmedHitRate,
      invalidationsByEntity: Object.fromEntries(this.invalidations),
    };
  }

  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.warmedHits = 0;
    this.warmedMisses = 0;
    this.invalidations.clear();
  }

  getCacheManager(): Cache {
    return this.cacheManager;
  }

  async flush(): Promise<void> {
    this.resetMetrics();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to retrieve the underlying ioredis client from cache-manager's store.
   * Returns undefined when running with an in-memory store (e.g. in tests).
   */
  private getRedisClient(): Redis | undefined {
    const store = (this.cacheManager as any).store;
    return store?.getClient?.() ?? store?.client ?? undefined;
  }

  /**
   * Use Redis SCAN + pipeline DEL for efficient pattern-based deletion.
   * This avoids KEYS which blocks the event loop on large keyspaces.
   */
  private async redisPatternDelete(client: Redis, pattern: string): Promise<void> {
    const redisGlob = pattern.endsWith('*') ? pattern : `${pattern}*`;
    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        redisGlob,
        'COUNT',
        '100',
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = client.pipeline();
        keys.forEach((k) => pipeline.del(k));
        await pipeline.exec();
        totalDeleted += keys.length;
      }
    } while (cursor !== '0');

    if (totalDeleted > 0) {
      this.logger.debug(`Deleted ${totalDeleted} keys matching "${redisGlob}"`);
    }
  }

  /**
   * Expand a list of keys by walking the dependency graph.
   * Falls back to the original list when no graph is registered.
   */
  private expandWithDependencies(keys: string[]): string[] {
    if (!this.dependencyGraph) return keys;

    const expanded = new Set<string>(keys);
    for (const key of keys) {
      const cascades = this.dependencyGraph.getInvalidationPatterns(key);
      cascades.forEach((k) => expanded.add(k));
    }
    return Array.from(expanded);
  }

  /**
   * Determines whether a key belongs to the set of pre-warmed cache entries.
   */
  private isWarmedCacheKey(key: string): boolean {
    const warmedPatterns = [
      'user_balances:',
      'market_price:',
      'portfolio:',
      'trading_pairs:',
      'market_data:',
    ];
    return warmedPatterns.some((p) => key.startsWith(p));
  }

  private trackInvalidation(entityType: string, count = 1): void {
    this.invalidations.set(
      entityType,
      (this.invalidations.get(entityType) ?? 0) + count,
    );
  }
}