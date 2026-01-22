import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from './performance.service';
import { DataSource } from 'typeorm';
import { Repository } from 'typeorm';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Bid } from '../bidding/entities/bid.entity';
import { OrderBook } from '../trading/entities/order-book.entity';
import { User } from '../user/entities/user.entity';

describe('PerformanceService', () => {
  let service: PerformanceService;
  let userBalanceRepository: Repository<UserBalance>;
  let tradeRepository: Repository<Trade>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: 'UserBalanceRepository',
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: 'TradeRepository',
          useValue: {
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: 'BidRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: 'OrderBookRepository',
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: 'UserRepository',
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('benchmarkQuery', () => {
    it('should measure query execution time', async () => {
      const mockQueryFn = jest.fn().mockResolvedValue({ data: 'test' });
      const result = await service.benchmarkQuery('test-query', mockQueryFn);

      expect(result.queryName).toBe('test-query');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.result).toEqual({ data: 'test' });
    });
  });

  describe('validatePerformanceTargets', () => {
    it('should validate that balance queries are under 100ms', async () => {
      jest.spyOn(service, 'runPerformanceBenchmarks').mockResolvedValue({
        getUserBalances: { executionTime: 50 },
        getUserTrades: { executionTime: 150 },
        getUserBids: { executionTime: 150 },
        getOrderBook: { executionTime: 150 },
        getPortfolioStats: { executionTime: 80 },
      } as any);

      const result = await service.validatePerformanceTargets();

      expect(result.validationResults.balanceQueriesUnder100ms).toBe(true);
      expect(result.validationResults.tradingQueriesUnder200ms).toBe(true);
      expect(result.allTargetsMet).toBe(true);
    });

    it('should detect when performance targets are not met', async () => {
      jest.spyOn(service, 'runPerformanceBenchmarks').mockResolvedValue({
        getUserBalances: { executionTime: 150 }, // Over 100ms
        getUserTrades: { executionTime: 250 }, // Over 200ms
        getUserBids: { executionTime: 150 },
        getOrderBook: { executionTime: 150 },
        getPortfolioStats: { executionTime: 80 },
      } as any);

      const result = await service.validatePerformanceTargets();

      expect(result.validationResults.balanceQueriesUnder100ms).toBe(false);
      expect(result.validationResults.tradingQueriesUnder200ms).toBe(false);
      expect(result.allTargetsMet).toBe(false);
    });
  });

  describe('simulateLoadTest', () => {
    it('should simulate concurrent user load', async () => {
      const mockFind = jest.fn().mockResolvedValue([]);
      jest.spyOn(service['userBalanceRepository'], 'find').mockImplementation(mockFind);
      jest.spyOn(service['tradeRepository'], 'find').mockImplementation(mockFind);

      const result = await service.simulateLoadTest(100);

      expect(result.concurrentUsers).toBe(100);
      expect(result.totalQueries).toBe(200); // 100 balance + 100 trade queries
      expect(result.success).toBe(true);
      expect(result.queriesPerSecond).toBeGreaterThan(0);
    });
  });
});
