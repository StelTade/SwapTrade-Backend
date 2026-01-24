import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Bid } from '../bidding/entities/bid.entity';
import { OrderBook } from '../trading/entities/order-book.entity';
import { User } from '../user/entities/user.entity';
import { OrderStatus } from '../common/enums/order-status.enum';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserBalance)
    private readonly userBalanceRepository: Repository<UserBalance>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @InjectRepository(OrderBook)
    private readonly orderBookRepository: Repository<OrderBook>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Execute EXPLAIN ANALYZE on a query and return the execution plan
   */
  async explainQuery(query: string, parameters?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
    return this.dataSource.query(explainQuery, parameters);
  }

  /**
   * Profile critical queries for performance analysis
   */
  async profileCriticalQueries(): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    // Profile user balance queries
    results.userBalanceQuery = await this.explainQuery(
      'SELECT * FROM user_balances WHERE userId = ? AND assetId = ?',
      ['1', '1']
    );

    // Profile trade queries
    results.tradeQuery = await this.explainQuery(
      'SELECT * FROM trade WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
      ['1']
    );

    // Profile bid queries
    results.bidQuery = await this.explainQuery(
      'SELECT * FROM bid WHERE userId = ? AND status = ? ORDER BY createdAt DESC',
      ['1', 'ACTIVE']
    );

    // Profile order book queries
    results.orderBookQuery = await this.explainQuery(
      'SELECT * FROM order_book WHERE asset = ? AND status = ? ORDER BY price ASC',
      ['BTC', 'OPEN']
    );

    return results;
  }

  /**
   * Benchmark query performance with timing
   */
  async benchmarkQuery(queryName: string, queryFn: () => Promise<any>): Promise<{ queryName: string; executionTime: number; result: any }> {
    const startTime = Date.now();
    const result = await queryFn();
    const executionTime = Date.now() - startTime;

    return {
      queryName,
      executionTime,
      result,
    };
  }

  /**
   * Run comprehensive performance benchmarks
   */
  async runPerformanceBenchmarks(): Promise<{ [key: string]: any }> {
    const results: { [key: string]: any } = {};

    // Benchmark balance queries
    results.getUserBalances = await this.benchmarkQuery(
      'getUserBalances',
      () => this.userBalanceRepository.find({
        where: { userId: 1 },
        relations: ['asset'],
      })
    );

    // Benchmark trade queries
    results.getUserTrades = await this.benchmarkQuery(
      'getUserTrades',
      () => this.tradeRepository.find({
        where: { userId: 1 },
        relations: ['user'],
        order: { timestamp: 'DESC' as any },
        take: 10,
      })
    );

    // Benchmark bid queries
    results.getUserBids = await this.benchmarkQuery(
      'getUserBids',
      () => this.bidRepository.find({
        where: { userId: 1, status: 'MATCHED' as any },
        relations: ['user'],
        order: { createdAt: 'DESC' as any },
      })
    );

    // Benchmark order book queries
    results.getOrderBook = await this.benchmarkQuery(
      'getOrderBook',
      () => this.orderBookRepository.find({
        where: { asset: 'BTC', status: OrderStatus.PENDING },
        relations: ['user'],
        order: { price: 'ASC' },
      })
    );

    // Benchmark portfolio stats
    results.getPortfolioStats = await this.benchmarkQuery(
      'getPortfolioStats',
      () => this.userBalanceRepository.find({
        where: { userId: 1 },
        relations: ['asset'],
      })
    );

    return results;
  }

  /**
   * Simulate load test with concurrent users
   */
  async simulateLoadTest(concurrentUsers: number = 1000): Promise<{ [key: string]: any }> {
    const promises: Promise<any>[] = [];
    const startTime = Date.now();

    // Simulate concurrent balance queries
    for (let i = 0; i < concurrentUsers; i++) {
      promises.push(
        this.userBalanceRepository.find({
          where: { userId: i % 100 },
          relations: ['asset'],
        })
      );
    }

    // Simulate concurrent trade queries
    for (let i = 0; i < concurrentUsers; i++) {
      promises.push(
        this.tradeRepository.find({
          where: { userId: i % 100 },
          relations: ['user'],
          order: { timestamp: 'DESC' as any },
          take: 5,
        })
      );
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    return {
      concurrentUsers,
      totalQueries: promises.length,
      totalTime,
      averageQueryTime: totalTime / promises.length,
      queriesPerSecond: Math.round((promises.length / totalTime) * 1000),
      success: true,
    };
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsageStats(): Promise<any> {
    // SQLite specific query to get index information
    const indexStats = await this.dataSource.query(`
      SELECT 
        m.tbl_name as table_name,
        i.name as index_name,
        i.sql as create_statement
      FROM sqlite_master m, sqlite_master i 
      WHERE m.type = 'table' 
      AND i.type = 'index' 
      AND i.tbl_name = m.name
      ORDER BY m.tbl_name, i.name;
    `);

    return indexStats;
  }

  /**
   * Validate performance targets are met
   */
  async validatePerformanceTargets(): Promise<{ [key: string]: any }> {
    const benchmarks = await this.runPerformanceBenchmarks();
    const validationResults = {
      balanceQueriesUnder100ms: benchmarks.getUserBalances.executionTime < 100,
      tradingQueriesUnder200ms: benchmarks.getUserTrades.executionTime < 200,
      bidQueriesUnder200ms: benchmarks.getUserBids.executionTime < 200,
      orderBookQueriesUnder200ms: benchmarks.getOrderBook.executionTime < 200,
      portfolioStatsUnder100ms: benchmarks.getPortfolioStats.executionTime < 100,
    };

    const allTargetsMet = Object.values(validationResults).every(result => result === true);

    return {
      validationResults,
      allTargetsMet,
      benchmarks,
    };
  }
}
