import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import type { Cache } from 'cache-manager';

export interface CacheLevel {
  name: string;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

export interface CacheMetrics {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l3Hits: number;
  l3Misses: number;
  totalRequests: number;
  overallHitRate: number;
  averageResponseTime: number;
}

@Injectable()
export class MultiLevelCacheService implements OnModuleInit {
  private readonly logger = new Logger(MultiLevelCacheService.name);
  private metrics: CacheMetrics = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    l3Hits: 0,
    l3Misses: 0,
    totalRequests: 0,
    overallHitRate: 0,
    averageResponseTime: 0,
  };

  private responseTimes: number[] = [];
  private readonly maxResponseTimeSamples = 1000;

  constructor(
    @InjectRedis('l1') private readonly l1Redis: Redis,
    @InjectRedis('l2') private readonly l2Redis: Redis,
    @InjectRedis('l3') private readonly l3Redis: Redis,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit() {
    this.logger.log('Multi-level cache service initialized');
    await this.warmupCriticalCache();
  }

  /**
   * Get value from multi-level cache with automatic fallback
   */
  async get<T>(key: string): Promise<T | undefined> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Level 1: L1 Redis (fastest, smallest TTL)
      const l1Result = await this.getFromLevel<T>('L1', this.l1Redis, key);
      if (l1Result !== undefined) {
        this.metrics.l1Hits++;
        this.recordResponseTime(Date.now() - startTime);
        return l1Result;
      }
      this.metrics.l1Misses++;

      // Level 2: L2 Redis (medium speed, medium TTL)
      const l2Result = await this.getFromLevel<T>('L2', this.l2Redis, key);
      if (l2Result !== undefined) {
        this.metrics.l2Hits++;
        // Promote to L1 with shorter TTL
        await this.setToLevel('L1', this.l1Redis, key, l2Result, 60);
        this.recordResponseTime(Date.now() - startTime);
        return l2Result;
      }
      this.metrics.l2Misses++;

      // Level 3: L3 Redis (slower, larger TTL)
      const l3Result = await this.getFromLevel<T>('L3', this.l3Redis, key);
      if (l3Result !== undefined) {
        this.metrics.l3Hits++;
        // Promote to L2 and L1
        await this.setToLevel('L2', this.l2Redis, key, l3Result, 300);
        await this.setToLevel('L1', this.l1Redis, key, l3Result, 60);
        this.recordResponseTime(Date.now() - startTime);
        return l3Result;
      }
      this.metrics.l3Misses++;

      this.recordResponseTime(Date.now() - startTime);
      return undefined;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      this.recordResponseTime(Date.now() - startTime);
      return undefined;
    }
  }

  /**
   * Set value in all cache levels with appropriate TTLs
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const defaultTTLs = {
      L1: 60,    // 1 minute
      L2: 300,   // 5 minutes
      L3: 3600,  // 1 hour
    };

    const finalTTL = ttl || defaultTTLs.L3;

    await Promise.allSettled([
      this.setToLevel('L1', this.l1Redis, key, value, Math.min(finalTTL, defaultTTLs.L1)),
      this.setToLevel('L2', this.l2Redis, key, value, Math.min(finalTTL, defaultTTLs.L2)),
      this.setToLevel('L3', this.l3Redis, key, value, finalTTL),
    ]);
  }

  /**
   * Delete from all cache levels
   */
  async del(key: string): Promise<void> {
    await Promise.allSettled([
      this.l1Redis.del(key),
      this.l2Redis.del(key),
      this.l3Redis.del(key),
      this.cacheManager.del(key),
    ]);
  }

  /**
   * Pattern-based invalidation across all levels
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const pipelineL1 = this.l1Redis.pipeline();
    const pipelineL2 = this.l2Redis.pipeline();
    const pipelineL3 = this.l3Redis.pipeline();

    // Scan and delete in each level
    await Promise.all([
      this.scanAndDelete(this.l1Redis, pattern, pipelineL1),
      this.scanAndDelete(this.l2Redis, pattern, pipelineL2),
      this.scanAndDelete(this.l3Redis, pattern, pipelineL3),
    ]);
  }

  /**
   * Warm up critical cache entries
   */
  async warmupCriticalCache(): Promise<void> {
    this.logger.log('Starting cache warmup...');
    
    const criticalKeys = [
      'market_price:BTC',
      'market_price:ETH',
      'trading_stats:5m',
      'top_traders:100:24h',
    ];

    const warmupPromises = criticalKeys.map(async (key) => {
      try {
        // This would typically fetch from the database
        // For now, we'll just set placeholder data
        await this.set(key, { warmed: true, timestamp: Date.now() }, 300);
        this.logger.debug(`Warmed up cache key: ${key}`);
      } catch (error) {
        this.logger.warn(`Failed to warm up cache key ${key}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
    this.logger.log('Cache warmup completed');
  }

  /**
   * Get cache performance metrics
   */
  getMetrics(): CacheMetrics {
    const totalHits = this.metrics.l1Hits + this.metrics.l2Hits + this.metrics.l3Hits;
    const totalMisses = this.metrics.l1Misses + this.metrics.l2Misses + this.metrics.l3Misses;
    const totalRequests = totalHits + totalMisses;

    this.metrics.overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    this.metrics.averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l3Hits: 0,
      l3Misses: 0,
      totalRequests: 0,
      overallHitRate: 0,
      averageResponseTime: 0,
    };
    this.responseTimes = [];
  }

  /**
   * Cache health check
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    const healthChecks = await Promise.allSettled([
      this.l1Redis.ping(),
      this.l2Redis.ping(),
      this.l3Redis.ping(),
    ]);

    const details = {
      l1: healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      l2: healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      l3: healthChecks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      metrics: this.getMetrics(),
    };

    const allHealthy = Object.values(details).slice(0, 3).every(status => status === 'healthy');
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      details,
    };
  }

  /**
   * Advanced caching strategies for trading data
   */
  async cacheTradeData(tradeData: any): Promise<void> {
    const key = `trade:${tradeData.id}`;
    const userKey = `user_trades:${tradeData.userId}`;
    const assetKey = `asset_trades:${tradeData.asset}`;
    const marketKey = `market_data:${tradeData.asset}`;

    // Cache individual trade
    await this.set(key, tradeData, 3600);

    // Update user trades list (using Redis sets for O(1) operations)
    await this.l1Redis.sadd(userKey, tradeData.id);
    await this.l1Redis.expire(userKey, 1800);

    // Update asset trades list
    await this.l1Redis.sadd(assetKey, tradeData.id);
    await this.l1Redis.expire(assetKey, 1800);

    // Invalidate market data cache
    await this.del(marketKey);
  }

  /**
   * Get user trades with optimized caching
   */
  async getUserTrades(userId: number, limit: number = 50): Promise<any[]> {
    const cacheKey = `user_trades_list:${userId}:${limit}`;
    
    let trades = await this.get<any[]>(cacheKey);
    if (trades) {
      return trades;
    }

    // Get trade IDs from Redis set
    const tradeIds = await this.l1Redis.smembers(`user_trades:${userId}`);
    
    if (tradeIds.length === 0) {
      return [];
    }

    // Batch get trade data
    const tradeKeys = tradeIds.map(id => `trade:${id}`);
    const tradeResults = await Promise.all(
      tradeKeys.map(key => this.get(key))
    );

    trades = tradeResults.filter(Boolean).slice(0, limit);
    await this.set(cacheKey, trades, 120);

    return trades;
  }

  private async getFromLevel<T>(
    levelName: string,
    redis: Redis,
    key: string,
  ): Promise<T | undefined> {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : undefined;
    } catch (error) {
      this.logger.warn(`Error getting from ${levelName}:`, error);
      return undefined;
    }
  }

  private async setToLevel<T>(
    levelName: string,
    redis: Redis,
    key: string,
    value: T,
    ttl: number,
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Error setting to ${levelName}:`, error);
    }
  }

  private async scanAndDelete(redis: Redis, pattern: string, pipeline: any): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        
        if (keys.length > 0) {
          keys.forEach(key => pipeline.del(key));
        }
      } while (cursor !== '0');

      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Error scanning and deleting pattern ${pattern}:`, error);
    }
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }
  }
}