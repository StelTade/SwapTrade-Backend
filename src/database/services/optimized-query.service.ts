import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { Trade } from '../entities/trade.entity';
import { UserBalance } from '../entities/user-balance.entity';
import { VirtualAsset } from '../entities/virtual-asset.entity';
import { CacheService } from '../../common/services/cache.service';

export interface QueryPerformanceMetrics {
  executionTime: number;
  rowsAffected: number;
  cacheHit: boolean;
  indexUsed?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@Injectable()
export class OptimizedQueryService {
  private readonly logger = new Logger(OptimizedQueryService.name);
  
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(UserBalance)
    private readonly balanceRepository: Repository<UserBalance>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepository: Repository<VirtualAsset>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Optimized user trade history with cursor-based pagination
   */
  async getUserTradeHistory(
    userId: number,
    limit: number = 50,
    cursor?: string,
    asset?: string,
  ): Promise<PaginatedResult<Trade>> {
    const startTime = Date.now();
    const cacheKey = this.cacheService.buildKey('user_trades:{{userId}}:{{limit}}:{{cursor}}:{{asset}}', {
      userId: userId.toString(),
      limit: limit.toString(),
      cursor: cursor || '0',
      asset: asset || 'all',
    });

    // Try cache first
    const cached = await this.cacheService.get<PaginatedResult<Trade>>(cacheKey);
    if (cached) {
      return cached;
    }

    let queryBuilder = this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.userId = :userId', { userId })
      .orderBy('trade.timestamp', 'DESC')
      .take(limit + 1); // +1 to check if there are more records

    if (asset) {
      queryBuilder = queryBuilder.andWhere('trade.asset = :asset', { asset });
    }

    if (cursor) {
      queryBuilder = queryBuilder.andWhere('trade.timestamp < :cursor', { 
        cursor: new Date(parseInt(cursor)) 
      });
    }

    const trades = await queryBuilder.getMany();
    const executionTime = Date.now() - startTime;

    const hasMore = trades.length > limit;
    const data = hasMore ? trades.slice(0, -1) : trades;
    const nextCursor = hasMore ? data[data.length - 1].timestamp.getTime().toString() : undefined;

    const result: PaginatedResult<Trade> = {
      data,
      total: data.length,
      page: 1,
      limit,
      hasNext: hasMore,
      hasPrev: !!cursor,
    };

    // Cache for 30 seconds
    await this.cacheService.set(cacheKey, result, 30);

    this.logger.debug(`User trade history query executed in ${executionTime}ms`);
    return result;
  }

  /**
   * High-performance market data aggregation
   */
  async getMarketDataAggregation(
    assets: string[],
    timeWindow: '1h' | '24h' | '7d' | '30d' = '24h',
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = this.cacheService.buildKey('market_agg:{{assets}}:{{timeWindow}}', {
      assets: assets.join(','),
      timeWindow,
    });

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const timeWindowMap = {
      '1h': "datetime('now', '-1 hour')",
      '24h': "datetime('now', '-1 day')",
      '7d': "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
    };

    const query = `
      SELECT 
        asset,
        COUNT(*) as trade_count,
        SUM(amount) as total_volume,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price,
        SUM(totalValue) as total_value,
        timestamp
      FROM trades 
      WHERE asset IN (${assets.map(() => '?').join(',')})
        AND timestamp > ${timeWindowMap[timeWindow]}
        AND status = 'EXECUTED'
      GROUP BY asset, strftime('%Y-%m-%d %H', timestamp)
      ORDER BY timestamp DESC
    `;

    const result = await this.dataSource.query(query, assets);
    const executionTime = Date.now() - startTime;

    // Cache market data for 60 seconds
    await this.cacheService.set(cacheKey, result, 60);

    this.logger.debug(`Market aggregation query executed in ${executionTime}ms`);
    return result;
  }

  /**
   * Optimized portfolio calculation with pre-aggregated data
   */
  async getUserPortfolioSnapshot(userId: number): Promise<any> {
    const startTime = Date.now();
    const cacheKey = `portfolio_snapshot:${userId}`;

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Use a single optimized query with proper indexes
    const query = `
      SELECT 
        b.assetId,
        b.balance,
        b.total,
        b.reserved,
        b.totalInvested,
        b.cumulativePnL,
        b.averageBuyPrice,
        b.totalTrades,
        b.totalTradeVolume,
        b.lastTradeDate,
        a.symbol as assetSymbol,
        a.name as assetName,
        a.price as currentPrice,
        (b.balance * a.price) as currentValue,
        (b.total * a.price) as totalCurrentValue,
        ((b.balance * a.price) - b.totalInvested) as unrealizedPnL
      FROM Balance b
      INNER JOIN virtual_assets a ON b.assetId = a.id
      WHERE b.userId = ?
        AND (b.balance > 0 OR b.totalInvested > 0)
      ORDER BY b.totalTradeVolume DESC
    `;

    const portfolio = await this.dataSource.query(query, [userId]);
    const executionTime = Date.now() - startTime;

    const result = {
      userId,
      assets: portfolio,
      totalValue: portfolio.reduce((sum, asset) => sum + parseFloat(asset.totalCurrentValue || 0), 0),
      totalInvested: portfolio.reduce((sum, asset) => sum + parseFloat(asset.totalInvested || 0), 0),
      totalPnL: portfolio.reduce((sum, asset) => sum + parseFloat(asset.unrealizedPnL || 0), 0),
      lastUpdated: new Date(),
    };

    // Cache portfolio for 120 seconds
    await this.cacheService.set(cacheKey, result, 120);

    this.logger.debug(`Portfolio snapshot query executed in ${executionTime}ms`);
    return result;
  }

  /**
   * Real-time trading statistics with time-window optimization
   */
  async getTradingStatistics(
    timeWindow: '1m' | '5m' | '15m' | '1h' = '5m',
  ): Promise<any> {
    const startTime = Date.now();
    const cacheKey = `trading_stats:${timeWindow}`;

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const timeWindowMap = {
      '1m': "datetime('now', '-1 minute')",
      '5m': "datetime('now', '-5 minutes')",
      '15m': "datetime('now', '-15 minutes')",
      '1h': "datetime('now', '-1 hour')",
    };

    const query = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(DISTINCT userId) as unique_traders,
        SUM(totalValue) as total_volume,
        AVG(amount) as avg_trade_size,
        MAX(price) as highest_price,
        MIN(price) as lowest_price,
        COUNT(CASE WHEN type = 'BUY' THEN 1 END) as buy_trades,
        COUNT(CASE WHEN type = 'SELL' THEN 1 END) as sell_trades,
        strftime('%Y-%m-%d %H:%M:%S', MAX(timestamp)) as last_trade_time
      FROM trades 
      WHERE timestamp > ${timeWindowMap[timeWindow]}
        AND status = 'EXECUTED'
    `;

    const stats = await this.dataSource.query(query);
    const executionTime = Date.now() - startTime;

    const result = {
      ...stats[0],
      timeWindow,
      calculatedAt: new Date(),
      executionTime,
    };

    // Cache stats for 10 seconds
    await this.cacheService.set(cacheKey, result, 10);

    this.logger.debug(`Trading statistics query executed in ${executionTime}ms`);
    return result;
  }

  /**
   * Optimized top traders leaderboard
   */
  async getTopTraders(limit: number = 100, period: '24h' | '7d' | '30d' = '24h'): Promise<any> {
    const startTime = Date.now();
    const cacheKey = `top_traders:${limit}:${period}`;

    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const periodMap = {
      '24h': "datetime('now', '-1 day')",
      '7d': "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
    };

    const query = `
      SELECT 
        t.userId,
        COUNT(*) as trade_count,
        SUM(t.totalValue) as total_volume,
        AVG(t.amount) as avg_trade_size,
        MAX(t.totalValue) as largest_trade,
        COUNT(DISTINCT t.asset) as unique_assets,
        u.email,
        u.createdAt as userSince
      FROM trades t
      INNER JOIN users u ON t.userId = u.id
      WHERE t.timestamp > ${periodMap[period]}
        AND t.status = 'EXECUTED'
      GROUP BY t.userId
      ORDER BY total_volume DESC
      LIMIT ?
    `;

    const traders = await this.dataSource.query(query, [limit]);
    const executionTime = Date.now() - startTime;

    const result = {
      traders,
      period,
      calculatedAt: new Date(),
      executionTime,
    };

    // Cache leaderboard for 300 seconds (5 minutes)
    await this.cacheService.set(cacheKey, result, 300);

    this.logger.debug(`Top traders query executed in ${executionTime}ms`);
    return result;
  }

  /**
   * Batch insert for high-volume trade data
   */
  async batchInsertTrades(trades: Partial<Trade>[]): Promise<void> {
    const startTime = Date.now();
    
    // Use TypeORM's bulk insert for better performance
    await this.tradeRepository
      .createQueryBuilder()
      .insert()
      .values(trades)
      .orUpdate(['amount', 'price', 'totalValue'], ['id'])
      .execute();

    const executionTime = Date.now() - startTime;
    this.logger.debug(`Batch insert of ${trades.length} trades executed in ${executionTime}ms`);

    // Invalidate relevant caches
    const affectedUsers = [...new Set(trades.map(t => t.userId).filter((id): id is number => id !== undefined))];
    const affectedAssets = [...new Set(trades.map(t => t.asset).filter((asset): asset is string => asset !== undefined))];

    await Promise.all([
      this.cacheService.invalidate('trading_stats:*'),
      this.cacheService.invalidate('market_agg:*'),
      ...affectedUsers.map(userId => this.cacheService.invalidateTradeRelatedCaches(userId, '')),
      ...affectedAssets.map(asset => this.cacheService.invalidateMarketPriceCache(asset)),
    ]);
  }

  /**
   * Health check for query performance
   */
  async getQueryPerformanceHealth(): Promise<any> {
    const startTime = Date.now();
    
    // Test query performance on critical paths
    const testQueries = [
      this.tradeRepository.count(),
      this.balanceRepository.count(),
      this.assetRepository.count(),
    ];

    const results = await Promise.all(testQueries);
    const executionTime = Date.now() - startTime;

    return {
      status: executionTime < 100 ? 'healthy' : 'degraded',
      executionTime,
      testResults: {
        tradesCount: results[0],
        balancesCount: results[1],
        assetsCount: results[2],
      },
      cacheMetrics: this.cacheService.getCacheMetrics(),
    };
  }
}