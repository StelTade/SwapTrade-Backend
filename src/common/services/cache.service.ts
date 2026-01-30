import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CacheHitMissMetrics } from '../cache/interfaces/cache-warming.interface';

@Injectable()
export class CacheService {
  private hits = 0;
  private misses = 0;
  private warmedHits = 0;
  private warmedMisses = 0;
  
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    if (value !== undefined) {
      this.hits++;
      // Track warmed cache hits
      if (this.isWarmedCacheKey(key)) {
        this.warmedHits++;
      }
    } else {
      this.misses++;
      // Track warmed cache misses
      if (this.isWarmedCacheKey(key)) {
        this.warmedMisses++;
      }
    }
    return value;
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, (ttl ?? 30) * 1000);
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Invalidate cache keys by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    // Note: cache-manager-redis-store doesn't support pattern-based deletion
    // This is a placeholder for when we need more advanced cache invalidation
    console.warn('Pattern-based cache invalidation not supported by current store');
  }

  /**
   * Invalidate specific cache keys
   */
  async invalidateKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.del(key);
    }
  }

  /**
   * Cache user balances (30s TTL)
   */
  async setUserBalanceCache(userId: string, balances: any): Promise<void> {
    await this.set(`user_balances:${userId}`, balances, 30); // 30 seconds
  }

  /**
   * Get user balances from cache
   */
  async getUserBalanceCache(userId: string): Promise<any | undefined> {
    return await this.get(`user_balances:${userId}`);
  }

  /**
   * Cache market prices (5m TTL)
   */
  async setMarketPriceCache(asset: string, price: any): Promise<void> {
    await this.set(`market_price:${asset}`, price, 300); // 5 minutes
  }

  /**
   * Get market prices from cache
   */
  async getMarketPriceCache(asset: string): Promise<any | undefined> {
    return await this.get(`market_price:${asset}`);
  }

  /**
   * Cache portfolio summary (1m TTL)
   */
  async setPortfolioCache(userId: string, portfolio: any): Promise<void> {
    await this.set(`portfolio:${userId}`, portfolio, 60); // 1 minute
  }

  /**
   * Get portfolio summary from cache
   */
  async getPortfolioCache(userId: string): Promise<any | undefined> {
    return await this.get(`portfolio:${userId}`);
  }

  /**
   * Invalidate user balance cache
   */
  async invalidateUserBalanceCache(userId: string): Promise<void> {
    await this.del(`user_balances:${userId}`);
  }

  /**
   * Invalidate market price cache
   */
  async invalidateMarketPriceCache(asset: string): Promise<void> {
    await this.del(`market_price:${asset}`);
  }

  /**
   * Invalidate portfolio cache
   */
  async invalidatePortfolioCache(userId: string): Promise<void> {
    await this.del(`portfolio:${userId}`);
  }

  /**
   * Invalidate all related caches after balance update
   */
  async invalidateBalanceRelatedCaches(userId: string): Promise<void> {
    await this.invalidateUserBalanceCache(userId);
    await this.invalidatePortfolioCache(userId);
  }

  /**
   * Invalidate all related caches after trade execution
   */
  async invalidateTradeRelatedCaches(userId: string, asset: string): Promise<void> {
    await this.invalidateUserBalanceCache(userId);
    await this.invalidatePortfolioCache(userId);
    await this.invalidateMarketPriceCache(asset);
  }

  /**
   * Invalidate all related caches after bid creation
   */
  async invalidateBidRelatedCaches(userId: string, asset: string): Promise<void> {
    await this.invalidateUserBalanceCache(userId);
    await this.invalidatePortfolioCache(userId);
  }

  /**
   * Check if a key is from warmed cache
   */
  private isWarmedCacheKey(key: string): boolean {
    // Keys that are typically warmed
    const warmedPatterns = [
      'user_balances:',
      'market_price:',
      'portfolio:',
      'trading_pairs:',
      'market_data:'
    ];
    return warmedPatterns.some(pattern => key.startsWith(pattern));
  }

  /**
   * Get cache hit/miss metrics
   */
  getCacheMetrics(): CacheHitMissMetrics {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    
    const warmedTotal = this.warmedHits + this.warmedMisses;
    const warmedHitRate = warmedTotal > 0 ? (this.warmedHits / warmedTotal) * 100 : 0;
    
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      warmedHits: this.warmedHits,
      warmedMisses: this.warmedMisses,
      warmedHitRate
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.warmedHits = 0;
    this.warmedMisses = 0;
  }

  /**
   * Get cache manager instance for advanced operations
   */
  getCacheManager(): Cache {
    return this.cacheManager;
  }
}