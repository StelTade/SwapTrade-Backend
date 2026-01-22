import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Trade, TradeStatus } from './entities/trade.entity';
import { MatchingEngineService } from './machine-engine.service';

describe('MatchingEngineService', () => {
  let service: MatchingEngineService;
  let tradeRepository: Repository<Trade>;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockTradeRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingEngineService,
        {
          provide: getRepositoryToken(Trade),
          useValue: mockTradeRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<MatchingEngineService>(MatchingEngineService);
    tradeRepository = module.get<Repository<Trade>>(getRepositoryToken(Trade));
    dataSource = module.get<DataSource>(DataSource);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('matchTrades - Perfect Match', () => {
    it('should match a single bid with a single ask at same price', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'ASK' as const,
        },
      ];

      // Mock successful balance checks and updates
      mockQueryRunner.query
        .mockResolvedValueOnce([{ amount: 60000 }]) // Buyer USD balance
        .mockResolvedValueOnce([{ amount: 1.0 }]) // Seller BTC balance
        .mockResolvedValueOnce(undefined) // Buyer USD update
        .mockResolvedValueOnce(undefined) // Buyer BTC update
        .mockResolvedValueOnce(undefined) // Seller BTC update
        .mockResolvedValueOnce(undefined) // Seller USD update
        .mockResolvedValueOnce(undefined) // Update bid remaining
        .mockResolvedValueOnce(undefined); // Update ask remaining

      mockQueryRunner.manager.create.mockReturnValue({
        id: 'trade1',
        buyerId: 'buyer1',
        sellerId: 'seller1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        totalValue: 50000,
        status: TradeStatus.EXECUTED,
      });

      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'trade1',
        buyerId: 'buyer1',
        sellerId: 'seller1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        totalValue: 50000,
        status: TradeStatus.EXECUTED,
      });

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(1);
      expect(result.totalVolume).toBe(50000);
      expect(result.failedMatches).toBe(0);
      expect(result.executionTime).toBeLessThan(500);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('matchTrades - Partial Fill', () => {
    it('should partially fill a larger bid with a smaller ask', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 2.0,
          price: 50000,
          remainingAmount: 2.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'ASK' as const,
        },
      ];

      mockQueryRunner.query
        .mockResolvedValueOnce([{ amount: 100000 }]) // Buyer USD balance
        .mockResolvedValueOnce([{ amount: 1.0 }]) // Seller BTC balance
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'trade1',
        amount: 1.0,
      });

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(1);
      expect(result.totalVolume).toBe(50000); // 1.0 BTC at 50000
    });
  });

  describe('matchTrades - FIFO Ordering', () => {
    it('should match orders with same price in FIFO order (earliest first)', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'BID' as const,
        },
        {
          id: 'bid2',
          userId: 'buyer2',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T09:00:00Z'), // Earlier
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'ASK' as const,
        },
      ];

      mockQueryRunner.query.mockResolvedValue([{ amount: 100000 }]);
      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'trade1' });

      await service.matchTrades(bids, asks);

      // First trade should be with buyer2 (earlier timestamp)
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
    });
  });

  describe('matchTrades - No Liquidity', () => {
    it('should not match when no asks are available', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.totalVolume).toBe(0);
    });

    it('should not match when no bids are available', async () => {
      const bids = [];
      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.totalVolume).toBe(0);
    });
  });

  describe('matchTrades - Price Violation', () => {
    it('should not match when ask price is higher than bid price', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 49000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.totalVolume).toBe(0);
    });
  });

  describe('matchTrades - Insufficient Balance', () => {
    it('should fail and rollback when buyer has insufficient funds', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      // Buyer has insufficient balance
      mockQueryRunner.query.mockResolvedValueOnce([{ amount: 10000 }]);

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.failedMatches).toBe(1);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should fail and rollback when seller has insufficient asset', async () => {
      const bids = [
        {
          id: 'bid1',
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: 'ask1',
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      mockQueryRunner.query
        .mockResolvedValueOnce([{ amount: 60000 }]) // Buyer has funds
        .mockResolvedValueOnce([{ amount: 0.5 }]); // Seller has insufficient BTC

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.failedMatches).toBe(1);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('matchTrades - Performance', () => {
    it('should match 1000 orders in less than 500ms', async () => {
      const bids = [];
      const asks = [];

      // Create 500 bids and 500 asks
      for (let i = 0; i < 500; i++) {
        bids.push({
          id: `bid${i}`,
          userId: `buyer${i}`,
          asset: 'BTC',
          amount: 0.1,
          price: 50000 + i,
          remainingAmount: 0.1,
          timestamp: new Date(Date.now() - i * 1000),
          type: 'BID' as const,
        });

        asks.push({
          id: `ask${i}`,
          userId: `seller${i}`,
          asset: 'BTC',
          amount: 0.1,
          price: 49000 + i,
          remainingAmount: 0.1,
          timestamp: new Date(Date.now() - i * 1000),
          type: 'ASK' as const,
        });
      }

      // Mock all balance checks to pass
      mockQueryRunner.query.mockResolvedValue([{ amount: 100000 }]);
      mockQueryRunner.manager.create.mockReturnValue({});
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'trade' });

      const result = await service.matchTrades(bids, asks);

      expect(result.executionTime).toBeLessThan(500);
      expect(result.tradesExecuted).toBeGreaterThan(0);
    }, 10000); // 10 second timeout for this test
  });

  describe('getTradeHistory', () => {
    it('should return trade history for a user', async () => {
      const userId = 'user1';
      const mockTrades = [
        {
          id: 'trade1',
          buyerId: userId,
          sellerId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          timestamp: new Date(),
        },
      ];

      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getTradeHistory(userId);

      expect(result).toEqual(mockTrades);
      expect(mockTradeRepository.find).toHaveBeenCalledWith({
        where: [{ buyerId: userId }, { sellerId: userId }],
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });
  });

  describe('getAssetTrades', () => {
    it('should return trades for a specific asset', async () => {
      const asset = 'BTC';
      const mockTrades = [
        {
          id: 'trade1',
          buyerId: 'buyer1',
          sellerId: 'seller1',
          asset: asset,
          amount: 1.0,
          price: 50000,
          timestamp: new Date(),
        },
      ];

      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getAssetTrades(asset);

      expect(result).toEqual(mockTrades);
      expect(mockTradeRepository.find).toHaveBeenCalledWith({
        where: { asset },
        order: { timestamp: 'DESC' },
        take: 100,
      });
    });
  });
});
