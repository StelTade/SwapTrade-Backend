import { Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalMemoryUsage: number;
  keyCount: number;
}

@Injectable()
export class EnhancedCacheService {
  private readonly logger = new Logger(EnhancedCacheService.name);
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalMemoryUsage: 0,
    keyCount: 0,
  };

  constructor(private readonly cache: Cache) {}

  /**
   * Get market price with intelligent caching
   * TTL: 30 seconds for real-time prices
   */
  async getMarketPrice(symbol: string): Promise<number | null> {
    const cacheKey = `market:price:${symbol}`;
    const result = await this.get<number>(cacheKey, 30); // 30 seconds

    if (result !== null) {
      this.logger.debug(`Market price cache hit: ${symbol} = ${result}`);
      return result;
    }

    this.logger.debug(`Market price cache miss: ${symbol}`);
    return null;
  }

  /**
   * Set market price with appropriate TTL
   */
  async setMarketPrice(symbol: string, price: number): Promise<void> {
    const cacheKey = `market:price:${symbol}`;
    await this.set(cacheKey, price, 30); // 30 seconds
    this.logger.debug(`Market price cached: ${symbol} = ${price} (30s TTL)`);
  }

  /**
   * Get user portfolio with extended caching
   * TTL: 2 minutes for portfolio data
   */
  async getUserPortfolio(userId: string): Promise<any | null> {
    const cacheKey = `portfolio:user:${userId}`;
    const result = await this.get<any>(cacheKey, 120); // 2 minutes

    if (result !== null) {
      this.logger.debug(`Portfolio cache hit: user ${userId}`);
      return result;
    }

    this.logger.debug(`Portfolio cache miss: user ${userId}`);
    return null;
  }

  /**
   * Set user portfolio with appropriate TTL
   */
  async setUserPortfolio(userId: string, portfolio: any): Promise<void> {
    const cacheKey = `portfolio:user:${userId}`;
    await this.set(cacheKey, portfolio, 120); // 2 minutes
    this.logger.debug(`Portfolio cached: user ${userId} (2m TTL)`);
  }

  /**
   * Get portfolio analytics with caching
   * TTL: 2 minutes for analytics
   */
  async getPortfolioAnalytics(userId: string): Promise<any | null> {
    const cacheKey = `analytics:portfolio:${userId}`;
    const result = await this.get<any>(cacheKey, 120); // 2 minutes

    if (result !== null) {
      this.logger.debug(`Portfolio analytics cache hit: user ${userId}`);
      return result;
    }

    this.logger.debug(`Portfolio analytics cache miss: user ${userId}`);
    return null;
  }

  /**
   * Set portfolio analytics with appropriate TTL
   */
  async setPortfolioAnalytics(userId: string, analytics: any): Promise<void> {
    const cacheKey = `analytics:portfolio:${userId}`;
    await this.set(cacheKey, analytics, 120); // 2 minutes
    this.logger.debug(`Portfolio analytics cached: user ${userId} (2m TTL)`);
  }

  /**
   * Get order book with high-frequency caching
   * TTL: 5 seconds for order book data
   */
  async getOrderBook(asset: string): Promise<any | null> {
    const cacheKey = `orderbook:${asset}`;
    const result = await this.get<any>(cacheKey, 5); // 5 seconds

    if (result !== null) {
      this.logger.debug(`Order book cache hit: ${asset}`);
      return result;
    }

    this.logger.debug(`Order book cache miss: ${asset}`);
    return null;
  }

  /**
   * Set order book with short TTL for real-time data
   */
  async setOrderBook(asset: string, orderBook: any): Promise<void> {
    const cacheKey = `orderbook:${asset}`;
    await this.set(cacheKey, orderBook, 5); // 5 seconds
    this.logger.debug(`Order book cached: ${asset} (5s TTL)`);
  }

  /**
   * Invalidate cache patterns for data updates
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `portfolio:user:${userId}`,
      `analytics:portfolio:${userId}`,
      `trades:user:${userId}`,
      `balance:user:${userId}`,
    ];

    for (const pattern of patterns) {
      await this.delete(pattern);
    }

    this.logger.log(`Invalidated cache for user ${userId}`);
  }

  /**
   * Invalidate market data cache
   */
  async invalidateMarketCache(symbol?: string): Promise<void> {
    if (symbol) {
      await this.delete(`market:price:${symbol}`);
      this.logger.log(`Invalidated market cache for ${symbol}`);
    } else {
      // Invalidate all market prices (pattern matching would be ideal here)
      const commonSymbols = [
        'BTC',
        'ETH',
        'XLM',
        'USDT',
        'USDC',
        'BNB',
        'SOL',
        'XRP',
        'ADA',
      ];
      for (const sym of commonSymbols) {
        await this.delete(`market:price:${sym}`);
      }
      this.logger.log('Invalidated all market cache');
    }
  }

  /**
   * Invalidate order book cache
   */
  async invalidateOrderBookCache(asset?: string): Promise<void> {
    if (asset) {
      await this.delete(`orderbook:${asset}`);
      this.logger.log(`Invalidated order book cache for ${asset}`);
    } else {
      // Would need pattern matching for wildcard deletion
      this.logger.log('Order book cache invalidation requires specific asset');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
    this.stats.hitRate = 0;
    this.logger.log('Cache statistics reset');
  }

  /**
   * Warm up cache with common data
   */
  async warmupCache(): Promise<void> {
    this.logger.log('Starting cache warmup...');

    try {
      // Warm up common market prices
      const commonSymbols = ['BTC', 'ETH', 'XLM', 'USDT', 'USDC'];
      for (const symbol of commonSymbols) {
        // This would typically call market data API
        const mockPrice = this.getMockPrice(symbol);
        await this.setMarketPrice(symbol, mockPrice);
      }

      this.logger.log('Cache warmup completed');
    } catch (error) {
      this.logger.error('Cache warmup failed', error.stack);
    }
  }

  private async get<T>(key: string, defaultTtl: number): Promise<T | null> {
    try {
      const cached = await this.cache.get<CacheEntry<T>>(key);

      if (cached) {
        // Check if expired
        if (Date.now() - cached.timestamp > cached.ttl * 1000) {
          await this.delete(key);
          this.stats.misses++;
          return null;
        }

        cached.hitCount++;
        this.stats.hits++;
        return cached.data;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error.message);
      this.stats.misses++;
      return null;
    }
  }

  private async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        hitCount: 0,
      };

      await this.cache.set(key, entry, ttl * 1000); // Convert to milliseconds
      this.stats.sets++;
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error.message);
    }
  }

  private async delete(key: string): Promise<void> {
    try {
      await this.cache.del(key);
      this.stats.deletes++;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error.message);
    }
  }

  private getMockPrice(symbol: string): number {
    const prices: Record<string, number> = {
      BTC: 45000,
      ETH: 3000,
      XLM: 0.25,
      USDT: 1,
      USDC: 1,
    };
    return prices[symbol] || 100;
  }
}
