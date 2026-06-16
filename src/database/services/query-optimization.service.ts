import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Trade } from '../entities/trade.entity';
import { UserBalance } from '../entities/user-balance.entity';
import { VirtualAsset } from '../entities/virtual-asset.entity';

export interface QueryExecutionPlan {
  id: string;
  query: string;
  parameters: any[];
  estimatedCost: number;
  estimatedRows: number;
  indexUsage: string[];
  executionTime: number;
  actualRows: number;
}

export interface QueryOptimizationResult {
  originalPlan: QueryExecutionPlan;
  optimizedPlan: QueryExecutionPlan;
  improvement: {
    timeReduction: number;
    costReduction: number;
    indexImprovement: string[];
  };
}

export interface QueryPattern {
  name: string;
  template: string;
  parameters: string[];
  indexes: string[];
  optimization: string;
}

@Injectable()
export class QueryOptimizationService {
  private readonly logger = new Logger(QueryOptimizationService.name);
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private executionPlans: Map<string, QueryExecutionPlan[]> = new Map();

  constructor(private readonly dataSource: DataSource) {
    this.initializeQueryPatterns();
  }

  /**
   * Initialize common query patterns with optimizations
   */
  private initializeQueryPatterns(): void {
    // User trade history pattern
    this.queryPatterns.set('user_trade_history', {
      name: 'user_trade_history',
      template: `
        SELECT * FROM trades 
        WHERE userId = ? 
          AND timestamp >= ? 
          AND timestamp <= ?
        ORDER BY timestamp DESC
        LIMIT ?
      `,
      parameters: ['userId', 'startDate', 'endDate', 'limit'],
      indexes: ['IDX_trades_user_asset_time', 'IDX_trades_user_recent'],
      optimization: 'Use composite index on (userId, timestamp) with DESC order',
    });

    // Market data aggregation pattern
    this.queryPatterns.set('market_aggregation', {
      name: 'market_aggregation',
      template: `
        SELECT 
          asset,
          COUNT(*) as trade_count,
          SUM(amount) as total_volume,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          SUM(totalValue) as total_value
        FROM trades 
        WHERE asset IN (?) 
          AND timestamp >= ?
          AND status = 'EXECUTED'
        GROUP BY asset
      `,
      parameters: ['assets', 'startTime'],
      indexes: ['IDX_trades_asset_status_time', 'IDX_trades_time_partition'],
      optimization: 'Use partial index on recent executed trades by asset',
    });

    // Portfolio snapshot pattern
    this.queryPatterns.set('portfolio_snapshot', {
      name: 'portfolio_snapshot',
      template: `
        SELECT 
          b.*,
          a.symbol as assetSymbol,
          a.price as currentPrice,
          (b.balance * a.price) as currentValue
        FROM Balance b
        INNER JOIN virtual_assets a ON b.assetId = a.id
        WHERE b.userId = ?
          AND (b.balance > 0 OR b.totalInvested > 0)
        ORDER BY b.totalTradeVolume DESC
      `,
      parameters: ['userId'],
      indexes: ['IDX_balance_user_asset_composite', 'IDX_balance_portfolio_covering'],
      optimization: 'Use covering index to include all required columns',
    });

    // Top traders pattern
    this.queryPatterns.set('top_traders', {
      name: 'top_traders',
      template: `
        SELECT 
          t.userId,
          COUNT(*) as trade_count,
          SUM(t.totalValue) as total_volume,
          COUNT(DISTINCT t.asset) as unique_assets
        FROM trades t
        WHERE t.timestamp >= ?
          AND t.status = 'EXECUTED'
        GROUP BY t.userId
        ORDER BY total_volume DESC
        LIMIT ?
      `,
      parameters: ['startTime', 'limit'],
      indexes: ['IDX_trades_time_partition', 'IDX_trades_dashboard_covering'],
      optimization: 'Use time partition index for efficient filtering',
    });
  }

  /**
   * Analyze and optimize a query
   */
  async optimizeQuery(
    query: string,
    parameters: any[] = [],
  ): Promise<QueryOptimizationResult> {
    const startTime = Date.now();
    
    // Execute original query and capture execution plan
    const originalPlan = await this.analyzeQueryExecution(query, parameters);
    
    // Generate optimized query
    const optimizedQuery = await this.generateOptimizedQuery(query, parameters);
    
    // Execute optimized query and capture execution plan
    const optimizedPlan = await this.analyzeQueryExecution(optimizedQuery.query, optimizedQuery.parameters);
    
    const executionTime = Date.now() - startTime;

    return {
      originalPlan,
      optimizedPlan,
      improvement: {
        timeReduction: ((originalPlan.executionTime - optimizedPlan.executionTime) / originalPlan.executionTime) * 100,
        costReduction: ((originalPlan.estimatedCost - optimizedPlan.estimatedCost) / originalPlan.estimatedCost) * 100,
        indexImprovement: this.compareIndexUsage(originalPlan.indexUsage, optimizedPlan.indexUsage),
      },
    };
  }

  /**
   * Analyze query execution plan
   */
  async analyzeQueryExecution(query: string, parameters: any[]): Promise<QueryExecutionPlan> {
    const startTime = Date.now();
    
    try {
      // For SQLite, we'll use EXPLAIN QUERY PLAN
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const explainResult = await this.dataSource.query(explainQuery, parameters);
      
      // Execute the actual query to get timing and row count
      const result = await this.dataSource.query(query, parameters);
      const executionTime = Date.now() - startTime;
      
      // Parse execution plan
      const indexUsage = this.parseIndexUsage(explainResult);
      
      return {
        id: this.generatePlanId(),
        query,
        parameters,
        estimatedCost: this.estimateQueryCost(explainResult),
        estimatedRows: this.estimateRowCount(explainResult),
        indexUsage,
        executionTime,
        actualRows: Array.isArray(result) ? result.length : 0,
      };
    } catch (error) {
      this.logger.error('Query analysis failed:', error);
      return {
        id: this.generatePlanId(),
        query,
        parameters,
        estimatedCost: 0,
        estimatedRows: 0,
        indexUsage: [],
        executionTime: Date.now() - startTime,
        actualRows: 0,
      };
    }
  }

  /**
   * Generate optimized query based on patterns
   */
  async generateOptimizedQuery(originalQuery: string, parameters: any[]): Promise<{ query: string; parameters: any[] }> {
    // Check if query matches any known patterns
    for (const [patternName, pattern] of this.queryPatterns) {
      if (this.queryMatchesPattern(originalQuery, pattern)) {
        return this.applyPatternOptimization(pattern, parameters);
      }
    }

    // Apply general optimizations
    return this.applyGeneralOptimizations(originalQuery, parameters);
  }

  /**
   * Create optimized query builder for common operations
   */
  createOptimizedTradeQuery(): SelectQueryBuilder<Trade> {
    return this.dataSource
      .getRepository(Trade)
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.buyer', 'buyer')
      .leftJoinAndSelect('trade.seller', 'seller')
      .cache(true, 30000) // 30 seconds cache
      .orderBy('trade.timestamp', 'DESC');
  }

  /**
   * Optimized user trade history with proper indexing
   */
  async getOptimizedUserTrades(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      asset?: string;
    } = {},
  ): Promise<{ trades: Trade[]; total: number; executionPlan: QueryExecutionPlan }> {
    const { limit = 50, offset = 0, startDate, endDate, asset } = options;

    let queryBuilder = this.dataSource
      .getRepository(Trade)
      .createQueryBuilder('trade')
      .where('trade.userId = :userId', { userId })
      .orderBy('trade.timestamp', 'DESC')
      .take(limit)
      .skip(offset);

    if (startDate) {
      queryBuilder = queryBuilder.andWhere('trade.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder = queryBuilder.andWhere('trade.timestamp <= :endDate', { endDate });
    }

    if (asset) {
      queryBuilder = queryBuilder.andWhere('trade.asset = :asset', { asset });
    }

    // Get total count
    const countQuery = queryBuilder.clone().orderBy().take().skip();
    const total = await countQuery.getCount();

    // Execute main query
    const trades = await queryBuilder.getMany();

    // Analyze execution
    const query = queryBuilder.getQuery();
    const parameters = queryBuilder.getParameters();
    const executionPlan = await this.analyzeQueryExecution(query, Object.values(parameters) || []);

    return { trades, total, executionPlan };
  }

  /**
   * Optimized market data with pre-aggregation
   */
  async getOptimizedMarketData(
    assets: string[],
    timeWindow: '1h' | '24h' | '7d' = '24h',
  ): Promise<{ data: any[]; executionPlan: QueryExecutionPlan }> {
    const timeWindowMap = {
      '1h': "datetime('now', '-1 hour')",
      '24h': "datetime('now', '-1 day')",
      '7d': "datetime('now', '-7 days')",
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

    const data = await this.dataSource.query(query, assets);
    const executionPlan = await this.analyzeQueryExecution(query, assets);

    return { data, executionPlan };
  }

  /**
   * Batch query optimization
   */
  async executeBatchQueries<T>(
    queries: Array<{ query: string; parameters?: any[] }>,
  ): Promise<Array<{ result: T; executionPlan: QueryExecutionPlan }>> {
    const results: Array<{ result: T; executionPlan: QueryExecutionPlan }> = [];

    for (const { query, parameters = [] } of queries) {
      const executionPlan = await this.analyzeQueryExecution(query, parameters);
      const result = await this.dataSource.query(query, parameters);
      
      results.push({ result, executionPlan });
    }

    return results;
  }

  /**
   * Query performance monitoring
   */
  async monitorQueryPerformance(queryId: string): Promise<any> {
    const plans = this.executionPlans.get(queryId) || [];
    
    if (plans.length === 0) {
      return { error: 'No execution plans found for query' };
    }

    const latestPlan = plans[plans.length - 1];
    const avgExecutionTime = plans.reduce((sum, plan) => sum + plan.executionTime, 0) / plans.length;
    const avgRows = plans.reduce((sum, plan) => sum + plan.actualRows, 0) / plans.length;

    return {
      queryId,
      latestExecution: latestPlan,
      averageExecutionTime: avgExecutionTime,
      averageRowsReturned: avgRows,
      totalExecutions: plans.length,
      performanceTrend: this.calculatePerformanceTrend(plans),
    };
  }

  /**
   * Index usage analysis
   */
  async analyzeIndexUsage(): Promise<any> {
    const indexAnalysis = {};

    for (const [patternName, pattern] of this.queryPatterns) {
      const plans = this.executionPlans.get(patternName) || [];
      const indexUsage = plans.flatMap(plan => plan.indexUsage);
      const indexFrequency = {};

      for (const index of indexUsage) {
        indexFrequency[index] = (indexFrequency[index] || 0) + 1;
      }

      indexAnalysis[patternName] = {
        pattern: pattern.name,
        recommendedIndexes: pattern.indexes,
        actualUsage: indexFrequency,
        optimizationApplied: pattern.optimization,
      };
    }

    return indexAnalysis;
  }

  private queryMatchesPattern(query: string, pattern: QueryPattern): boolean {
    // Simplified pattern matching - in production, use more sophisticated matching
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedPattern = pattern.template.toLowerCase().replace(/\s+/g, ' ').trim();
    
    return normalizedQuery.includes(normalizedPattern.split('from')[1]?.split('where')[0] || '');
  }

  private applyPatternOptimization(pattern: QueryPattern, parameters: any[]): { query: string; parameters: any[] } {
    // Apply pattern-specific optimizations
    let optimizedQuery = pattern.template;
    
    // Add index hints if supported
    if (pattern.indexes.length > 0) {
      // This would be database-specific
      // For SQLite, we can't add index hints directly
    }

    return { query: optimizedQuery, parameters };
  }

  private applyGeneralOptimizations(query: string, parameters: any[]): { query: string; parameters: any[] } {
    let optimizedQuery = query;

    // Add LIMIT if not present for large result sets
    if (!optimizedQuery.toLowerCase().includes('limit') && !optimizedQuery.toLowerCase().includes('top')) {
      optimizedQuery += ' LIMIT 1000';
    }

    // Ensure proper ordering for pagination
    if (!optimizedQuery.toLowerCase().includes('order by') && optimizedQuery.toLowerCase().includes('limit')) {
      optimizedQuery += ' ORDER BY id DESC';
    }

    return { query: optimizedQuery, parameters };
  }

  private parseIndexUsage(explainResult: any[]): string[] {
    const indexes: string[] = [];
    
    for (const row of explainResult) {
      if (row.detail && row.detail.includes('USING INDEX')) {
        const indexMatch = row.detail.match(/USING INDEX (\w+)/);
        if (indexMatch) {
          indexes.push(indexMatch[1]);
        }
      }
    }

    return indexes;
  }

  private estimateQueryCost(explainResult: any[]): number {
    // Simplified cost estimation
    return explainResult.length * 10;
  }

  private estimateRowCount(explainResult: any[]): number {
    // Simplified row count estimation
    return explainResult.reduce((sum, row) => sum + (row.estRows || 0), 0);
  }

  private compareIndexUsage(original: string[], optimized: string[]): string[] {
    const improvements = [] as string[];
    
    for (const index of optimized) {
      if (!original.includes(index)) {
        improvements.push(`Added index usage: ${index}`);
      }
    }

    for (const index of original) {
      if (!optimized.includes(index)) {
        improvements.push(`Removed index usage: ${index}`);
      }
    }

    return improvements;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePerformanceTrend(plans: QueryExecutionPlan[]): 'improving' | 'degrading' | 'stable' {
    if (plans.length < 2) return 'stable';

    const recent = plans.slice(-5);
    const older = plans.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, plan) => sum + plan.executionTime, 0) / recent.length;
    const olderAvg = older.reduce((sum, plan) => sum + plan.executionTime, 0) / older.length;

    const improvement = ((olderAvg - recentAvg) / olderAvg) * 100;

    if (improvement > 10) return 'improving';
    if (improvement < -10) return 'degrading';
    return 'stable';
  }
}
