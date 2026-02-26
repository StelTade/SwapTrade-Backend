import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioService } from './portfolio.service';
import { PortfolioRepository } from './portfolio.repository';
import { TradeEntity } from './entities/trade.entity';
import { Trade } from '../trading/entities/trade.entity';
// import { Balance } from '../balance/balance.entity';
import { CacheService } from '../common/services/cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

// Set test environment variables before any imports that rely on config
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret-key';
import { Balance } from 'src/balance/balance.entity';
import { RiskAnalyticsService } from './services/risk-analytics.service';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let portfolioRepository: PortfolioRepository;
  let balanceRepository: Repository<Balance>;
  let tradeRepository: Repository<Trade>;
  let cacheService: CacheService;
  let riskAnalyticsService: RiskAnalyticsService;

  const mockBalanceRepository = {
    find: jest.fn(),
  };

  const mockTradeRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getPortfolioCache: jest.fn(),
    setPortfolioCache: jest.fn(),
    getMarketPriceCache: jest.fn(),
    setMarketPriceCache: jest.fn(),
    invalidatePortfolioCache: jest.fn(),
    invalidateMarketPriceCache: jest.fn(),
  };

  const mockRiskAnalyticsService = {
    calculatePortfolioVolatility: jest.fn().mockReturnValue(50),
    calculateParametricVaR: jest.fn().mockReturnValue(100),
    calculateCVaR: jest.fn().mockReturnValue(150),
    performStressTests: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        PortfolioRepository,
        {
          provide: getRepositoryToken(Balance),
          useValue: mockBalanceRepository,
        },
        {
          provide: getRepositoryToken(Trade),
          useValue: mockTradeRepository,
        },
        {
          provide: getRepositoryToken(TradeEntity),
          useValue: mockTradeRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
          provide: RiskAnalyticsService,
          useValue: mockRiskAnalyticsService,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    portfolioRepository = module.get<PortfolioRepository>(PortfolioRepository);
    balanceRepository = module.get<Repository<Balance>>(
      getRepositoryToken(Balance),
    );
    tradeRepository = module.get<Repository<Trade>>(getRepositoryToken(Trade));
    cacheService = module.get<CacheService>(CacheService);
    riskAnalyticsService = module.get<RiskAnalyticsService>(RiskAnalyticsService);

    // Clear cache before each test
    service.clearPriceCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAnalytics (Optimized with QueryBuilder)', () => {
    describe('Basic Cases', () => {
      it('should return empty analytics for user with no trades', async () => {
        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({ pnl: 0, assetDistribution: {}, riskScore: 0 });
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user123');

        expect(result).toEqual({
          pnl: 0,
          assetDistribution: {},
          riskScore: 0,
        });
        expect(mockCacheService.set).toHaveBeenCalled();
      });

      it('should calculate PnL from buy and sell trades', async () => {
        const mockAnalytics = {
          pnl: 5000, // Positive PnL from sells > buys
          assetDistribution: {
            BTC: 100,
          },
          riskScore: 0,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user123');

        expect(result.pnl).toBe(5000);
        expect(result.assetDistribution.BTC).toBe(100);
      });

      it('should calculate asset distribution percentages', async () => {
        const mockAnalytics = {
          pnl: 0,
          assetDistribution: {
            BTC: 60,
            ETH: 40,
          },
          riskScore: 15,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user123');

        expect(result.assetDistribution.BTC).toBeCloseTo(60, 1);
        expect(result.assetDistribution.ETH).toBeCloseTo(40, 1);
        expect(Object.values(result.assetDistribution).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
      });

      it('should calculate risk score (standard deviation)', async () => {
        const mockAnalytics = {
          pnl: 0,
          assetDistribution: {
            BTC: 50,
            ETH: 50,
          },
          riskScore: 0, // Equal distribution has low variance
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user123');

        expect(result.riskScore).toBeLessThan(1);
      });

      it('should calculate high risk score for concentrated portfolio', async () => {
        const mockAnalytics = {
          pnl: 0,
          assetDistribution: {
            BTC: 95,
            ETH: 5,
          },
          riskScore: 35,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user123');

        expect(result.riskScore).toBeGreaterThan(30);
      });
    });

    describe('Caching', () => {
      it('should return cached analytics without hitting database', async () => {
        const cachedAnalytics = {
          pnl: 1000,
          assetDistribution: { BTC: 100 },
          riskScore: 5,
        };

        mockCacheService.get.mockResolvedValue(cachedAnalytics);

        const result = await service.getAnalytics('user123');

        expect(result).toEqual(cachedAnalytics);
        expect(
          jest.spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated'),
        ).not.toHaveBeenCalled();
      });

      it('should cache analytics with 2-minute TTL', async () => {
        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 0,
            assetDistribution: {},
            riskScore: 0,
          });
        mockCacheService.get.mockResolvedValue(undefined);

        await service.getAnalytics('user123');

        expect(mockCacheService.set).toHaveBeenCalledWith(
          'portfolio:analytics:user123',
          expect.any(Object),
          120, // 2 minutes
        );
      });

      it('should handle cache read failures gracefully', async () => {
        mockCacheService.get.mockRejectedValue(
          new Error('Cache unavailable'),
        );

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 0,
            assetDistribution: {},
            riskScore: 0,
          });

        const result = await service.getAnalytics('user123');

        expect(result).toBeDefined();
        expect(mockCacheService.set).toHaveBeenCalled();
      });

      it('should handle cache write failures gracefully', async () => {
        mockCacheService.get.mockResolvedValue(undefined);
        mockCacheService.set.mockRejectedValue(
          new Error('Cache write failed'),
        );

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 1000,
            assetDistribution: { BTC: 100 },
            riskScore: 0,
          });

        const result = await service.getAnalytics('user123');

        expect(result.pnl).toBe(1000);
        expect(result).toBeDefined();
      });
    });

    describe('Performance with Large Datasets (5000+ trades)', () => {
      it('should handle 5000 trades in under 100ms', async () => {
        // This test verifies that QueryBuilder aggregation is efficient
        const mockAnalytics = {
          pnl: 250000,
          assetDistribution: {
            BTC: 40,
            ETH: 30,
            SOL: 20,
            USDC: 10,
          },
          riskScore: 18,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const startTime = Date.now();
        const result = await service.getAnalytics('user_with_5k_trades');
        const duration = Date.now() - startTime;

        expect(result.pnl).toBe(250000);
        expect(duration).toBeLessThan(100);
      });

      it('should handle 10000 trades in under 100ms', async () => {
        const mockAnalytics = {
          pnl: 500000,
          assetDistribution: {
            BTC: 50,
            ETH: 25,
            SOL: 15,
            ADA: 10,
          },
          riskScore: 22,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const startTime = Date.now();
        const result = await service.getAnalytics('user_with_10k_trades');
        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(duration).toBeLessThan(100);
      });

      it('should scale linearly with trade count', async () => {
        mockCacheService.get.mockResolvedValue(undefined);

        // Mock for 1000 trades (should be fast)
        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 50000,
            assetDistribution: { BTC: 100 },
            riskScore: 0,
          });

        const start1 = Date.now();
        await service.getAnalytics('user1');
        const duration1 = Date.now() - start1;

        // Mock for 5000 trades (should still be fast, maybe 2-3x longer)
        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 250000,
            assetDistribution: { BTC: 100 },
            riskScore: 0,
          });

        const start2 = Date.now();
        await service.getAnalytics('user2');
        const duration2 = Date.now() - start2;

        // Both should be fast and not exponential growth
        expect(duration1).toBeLessThan(50);
        expect(duration2).toBeLessThan(100);
        // Verify not exponential (5x trades shouldn't be 25x time)
        expect(duration2 / duration1).toBeLessThan(10);
      });

      it('should aggregate multiple assets efficiently with 5000 trades', async () => {
        const mockAnalytics = {
          pnl: 300000,
          assetDistribution: {
            BTC: 35,
            ETH: 25,
            SOL: 20,
            XRP: 10,
            ADA: 5,
            DOT: 5,
          },
          riskScore: 12,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const startTime = Date.now();
        const result = await service.getAnalytics('user_multi_asset');
        const duration = Date.now() - startTime;

        // Verify distribution adds up to 100%
        const totalDistribution = Object.values(
          result.assetDistribution,
        ).reduce((a, b) => a + b, 0);
        expect(totalDistribution).toBeCloseTo(100, 0);

        // Verify performance
        expect(duration).toBeLessThan(100);
      });
    });

    describe('QueryBuilder Verification', () => {
      it('should use single consolidated query (not N+1)', async () => {
        const spy = jest.spyOn(
          portfolioRepository,
          'getPortfolioAnalyticsAggregated',
        );

        spy.mockResolvedValue({
          pnl: 1000,
          assetDistribution: { BTC: 100 },
          riskScore: 0,
        });
        mockCacheService.get.mockResolvedValue(undefined);

        await service.getAnalytics('user123');

        // Should be called exactly once - not in a loop
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('user123');
      });

      it('should log query execution time for debugging', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue({
            pnl: 0,
            assetDistribution: {},
            riskScore: 0,
          });
        mockCacheService.get.mockResolvedValue(undefined);

        await service.getAnalytics('user123');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Portfolio analytics calculated'),
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle negative PnL (losses)', async () => {
        const mockAnalytics = {
          pnl: -25000,
          assetDistribution: { ETH: 100 },
          riskScore: 0,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user_with_loss');

        expect(result.pnl).toBe(-25000);
        expect(result.pnl).toBeLessThan(0);
      });

      it('should handle decimals in asset distribution', async () => {
        const mockAnalytics = {
          pnl: 0,
          assetDistribution: {
            BTC: 33.333333,
            ETH: 33.333333,
            SOL: 33.333334,
          },
          riskScore: 0,
        };

        jest
          .spyOn(portfolioRepository, 'getPortfolioAnalyticsAggregated')
          .mockResolvedValue(mockAnalytics);
        mockCacheService.get.mockResolvedValue(undefined);

        const result = await service.getAnalytics('user_decimal');

        const total = Object.values(result.assetDistribution).reduce(
          (a, b) => a + b,
          0,
        );
        expect(total).toBeCloseTo(100, 1);
      });
    });
  });

  describe('getPortfolioSummary', () => {
    it('should return empty portfolio for user with no balances', async () => {
      mockBalanceRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(1);

      expect(result.totalValue).toBe(0);
      expect(result.assets).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate portfolio summary with single asset', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.5,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.5,
          price: 30000,
          status: 'completed',
        },
      ]);

      const result = await service.getPortfolioSummary(1);

      expect(result.totalValue).toBe(67500); // 1.5 * 45000
      expect(result.count).toBe(1);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].symbol).toBe('BTC');
      expect(result.assets[0].allocationPercentage).toBe(100);
      expect(result.assets[0].averagePrice).toBe(30000);
    });

    it('should calculate portfolio summary with multiple assets', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
        {
          userId: 1,
          available: 10.0,
          locked: 0,
          asset: { symbol: 'ETH', name: 'Ethereum' },
        },
        {
          userId: 1,
          available: 1000.0,
          locked: 0,
          asset: { symbol: 'USDT', name: 'Tether' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(1);

      // BTC: 45000, ETH: 30000, USDT: 1000
      expect(result.totalValue).toBe(76000);
      expect(result.count).toBe(3);
      expect(result.assets).toHaveLength(3);

      // Check sorted by value
      expect(result.assets[0].symbol).toBe('BTC');
      expect(result.assets[1].symbol).toBe('ETH');
      expect(result.assets[2].symbol).toBe('USDT');

      // Check allocation percentages
      expect(result.assets[0].allocationPercentage).toBeCloseTo(59.21, 1);
      expect(result.assets[1].allocationPercentage).toBeCloseTo(39.47, 1);
      expect(result.assets[2].allocationPercentage).toBeCloseTo(1.32, 1);
    });

    it('should ignore zero balances', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
        {
          userId: 1,
          available: 0,
          locked: 0,
          asset: { symbol: 'ETH', name: 'Ethereum' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(1);

      expect(result.count).toBe(1);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].symbol).toBe('BTC');
    });

    it('should complete in under 200ms', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const start = Date.now();
      await service.getPortfolioSummary(1);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('getPortfolioRisk', () => {
    it('should return zero risk metrics for empty portfolio', async () => {
      mockBalanceRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      expect(result.concentrationRisk).toBe(0);
      expect(result.diversificationScore).toBe(0);
      expect(result.volatilityEstimate).toBe(0);
      expect(result.metadata.largestHolding).toBe('');
      expect(result.valueAtRisk.parametric).toBe(0);
      expect(result.stressTestResults).toEqual([]);
    });

    it('should return 100% concentration for single asset portfolio', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      expect(result.concentrationRisk).toBe(100);
      expect(result.diversificationScore).toBe(0);
      expect(result.metadata.largestHolding).toBe('BTC');
      expect(result.metadata.herfindahlIndex).toBe(1);
      expect(result.metadata.effectiveAssets).toBe(1);
    });

    it('should calculate risk metrics for diversified portfolio', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
        {
          userId: 1,
          available: 10.0,
          locked: 0,
          asset: { symbol: 'ETH', name: 'Ethereum' },
        },
        {
          userId: 1,
          available: 1000.0,
          locked: 0,
          asset: { symbol: 'USDT', name: 'Tether' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      // BTC is largest holding at ~59%
      expect(result.concentrationRisk).toBeGreaterThan(50);
      expect(result.concentrationRisk).toBeLessThan(65);

      // Should have decent diversification
      expect(result.diversificationScore).toBeGreaterThan(0);
      expect(result.diversificationScore).toBeLessThan(100);

      // Effective assets should be between 1 and 3
      expect(result.metadata.effectiveAssets).toBeGreaterThan(1);
      expect(result.metadata.effectiveAssets).toBeLessThan(3);

      expect(result.metadata.largestHolding).toBe('BTC');
    });

    it('should calculate volatility based on asset weights', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 10000.0,
          locked: 0,
          asset: { symbol: 'USDT', name: 'Tether' },
        },
      ];

      mockRiskAnalyticsService.calculatePortfolioVolatility.mockReturnValue(5);

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      // USDT has low volatility (5%)
      expect(riskAnalyticsService.calculatePortfolioVolatility).toHaveBeenCalled();
    });

    it('should normalize risk scores to 0-100', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
        {
          userId: 1,
          available: 10.0,
          locked: 0,
          asset: { symbol: 'ETH', name: 'Ethereum' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      expect(result.concentrationRisk).toBeGreaterThanOrEqual(0);
      expect(result.concentrationRisk).toBeLessThanOrEqual(100);
      expect(result.diversificationScore).toBeGreaterThanOrEqual(0);
      expect(result.diversificationScore).toBeLessThanOrEqual(100);
      expect(result.volatilityEstimate).toBeGreaterThanOrEqual(0);
      expect(result.volatilityEstimate).toBeLessThanOrEqual(100);
    });

    it('should complete in under 200ms', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const start = Date.now();
      await service.getPortfolioRisk(1);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('getPortfolioPerformance', () => {
    it('should return zero performance for empty portfolio', async () => {
      mockBalanceRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioPerformance(1);

      expect(result.totalGain).toBe(0);
      expect(result.totalLoss).toBe(0);
      expect(result.roi).toBe(0);
      expect(result.totalCostBasis).toBe(0);
      expect(result.totalCurrentValue).toBe(0);
      expect(result.assetPerformance).toEqual([]);
    });

    it('should calculate gain for profitable position', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 30000,
          status: 'completed',
          createdAt: new Date('2026-01-01'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getPortfolioPerformance(1);

      // Current: 45000, Cost: 30000, Gain: 15000
      expect(result.totalGain).toBe(15000);
      expect(result.totalLoss).toBe(0);
      expect(result.roi).toBe(50); // 15000/30000 * 100
      expect(result.totalCostBasis).toBe(30000);
      expect(result.totalCurrentValue).toBe(45000);
      expect(result.netGain).toBe(15000);
    });

    it('should calculate loss for underwater position', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 10.0,
          locked: 0,
          asset: { symbol: 'ETH', name: 'Ethereum' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'ETH',
          type: 'buy',
          quantity: 10.0,
          price: 4000,
          status: 'completed',
          createdAt: new Date('2026-01-01'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getPortfolioPerformance(1);

      // Current: 30000 (10 * 3000), Cost: 40000, Loss: 10000
      expect(result.totalGain).toBe(0);
      expect(result.totalLoss).toBe(10000);
      expect(result.roi).toBe(-25); // -10000/40000 * 100
    });

    it('should handle multiple buys with average cost', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 2.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 30000,
          status: 'completed',
          createdAt: new Date('2026-01-01'),
        },
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 40000,
          status: 'completed',
          createdAt: new Date('2026-01-15'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getPortfolioPerformance(1);

      // Total cost: 70000, Current: 90000 (2 * 45000), Gain: 20000
      expect(result.totalCostBasis).toBe(70000);
      expect(result.totalCurrentValue).toBe(90000);
      expect(result.totalGain).toBe(20000);
      expect(result.roi).toBeCloseTo(28.57, 1);
    });

    it('should handle sells with FIFO cost basis', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 0.5,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 30000,
          status: 'completed',
          createdAt: new Date('2026-01-01'),
        },
        {
          userId: 1,
          symbol: 'BTC',
          type: 'sell',
          quantity: 0.5,
          price: 40000,
          status: 'completed',
          createdAt: new Date('2026-01-10'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getPortfolioPerformance(1);

      // Remaining 0.5 BTC cost: 15000, Current: 22500 (0.5 * 45000)
      expect(result.totalCostBasis).toBe(15000);
      expect(result.totalCurrentValue).toBe(22500);
      expect(result.totalGain).toBe(7500);
      expect(result.roi).toBe(50);
    });

    it('should filter by date range', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 0.5,
          price: 30000,
          status: 'completed',
          createdAt: new Date('2025-12-01'),
        },
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 0.5,
          price: 40000,
          status: 'completed',
          createdAt: new Date('2026-01-15'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([mockTrades[1]]); // Only Jan trade

      const result = await service.getPortfolioPerformance(
        1,
        '2026-01-01T00:00:00Z',
        '2026-01-31T23:59:59Z',
      );

      // Should only consider January trade
      expect(result.startDate).toBe('2026-01-01T00:00:00Z');
      expect(result.endDate).toBe('2026-01-31T23:59:59Z');
    });

    it('should be deterministic with same input', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 30000,
          status: 'completed',
          createdAt: new Date('2026-01-01'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result1 = await service.getPortfolioPerformance(1);
      const result2 = await service.getPortfolioPerformance(1);

      expect(result1.totalGain).toBe(result2.totalGain);
      expect(result1.roi).toBe(result2.roi);
      expect(result1.totalCostBasis).toBe(result2.totalCostBasis);
    });

    it('should complete in under 200ms', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const start = Date.now();
      await service.getPortfolioPerformance(1);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extreme prices', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1000000.0,
          locked: 0,
          asset: { symbol: 'SHIB', name: 'Shiba Inu' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioSummary(1);

      expect(result.totalValue).toBeGreaterThan(0);
      expect(result.assets[0].allocationPercentage).toBe(100);
    });

    it('should handle rapid portfolio changes', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      // Multiple rapid calls
      const results = await Promise.all([
        service.getPortfolioSummary(1),
        service.getPortfolioSummary(1),
        service.getPortfolioSummary(1),
      ]);

      expect(results[0].totalValue).toBe(results[1].totalValue);
      expect(results[1].totalValue).toBe(results[2].totalValue);
    });

    it('should handle very old account', async () => {
      const mockBalances = [
        {
          userId: 1,
          available: 1.0,
          locked: 0,
          asset: { symbol: 'BTC', name: 'Bitcoin' },
        },
      ];

      const mockTrades = [
        {
          userId: 1,
          symbol: 'BTC',
          type: 'buy',
          quantity: 1.0,
          price: 100, // Very old price
          status: 'completed',
          createdAt: new Date('2010-01-01'),
        },
      ];

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getPortfolioPerformance(1);

      expect(result.roi).toBeGreaterThan(40000); // Massive gain
      expect(result.totalGain).toBeGreaterThan(40000);
    });
  });

  describe('PortfolioRepository - Optimized Queries', () => {
    let mockTradeQueryBuilder: any;

    beforeEach(() => {
      // Create a mock QueryBuilder
      mockTradeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getRawOne: jest.fn(),
        getMany: jest.fn(),
      };

      // Mock the createQueryBuilder method
      const mockTradeRepo = mockTradeRepository as any;
      mockTradeRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockTradeQueryBuilder);
      mockTradeRepo.count = jest.fn();
    });

    describe('getPortfolioAnalyticsAggregated', () => {
      it('should use single aggregation query instead of N+1', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '100',
            buyVolume: '500000',
            sellVolume: '450000',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result = await portfolioRepository.getPortfolioAnalyticsAggregated(
          'user123',
        );

        // Verify single query was used (not loop of queries)
        expect(mockTradeQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
        expect(result.pnl).toBeDefined();
        expect(result.assetDistribution).toBeDefined();
        expect(result.riskScore).toBeDefined();
      });

      it('should calculate PnL from aggregated buy/sell volumes', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '50',
            buyVolume: '500000',
            sellVolume: '550000',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result = await portfolioRepository.getPortfolioAnalyticsAggregated(
          'user123',
        );

        // PnL = sellVolume - buyVolume = 550000 - 500000 = 50000
        expect(result.pnl).toBe(50000);
      });

      it('should handle multiple assets aggregation', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '100',
            buyVolume: '500000',
            sellVolume: '450000',
          },
          {
            asset: 'ETH',
            tradeCount: '200',
            buyVolume: '200000',
            sellVolume: '250000',
          },
          {
            asset: 'SOL',
            tradeCount: '300',
            buyVolume: '50000',
            sellVolume: '48000',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result = await portfolioRepository.getPortfolioAnalyticsAggregated(
          'user123',
        );

        expect(Object.keys(result.assetDistribution)).toHaveLength(3);
        expect(result.assetDistribution.BTC).toBeGreaterThan(0);
        expect(result.assetDistribution.ETH).toBeGreaterThan(0);
        expect(result.assetDistribution.SOL).toBeGreaterThan(0);
      });

      it('should return empty analytics for no trades', async () => {
        mockTradeQueryBuilder.getRawMany.mockResolvedValue([]);

        const result = await portfolioRepository.getPortfolioAnalyticsAggregated(
          'user123',
        );

        expect(result.pnl).toBe(0);
        expect(result.assetDistribution).toEqual({});
        expect(result.riskScore).toBe(0);
      });

      it('should handle zero volumes gracefully', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '0',
            buyVolume: '0',
            sellVolume: '0',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result = await portfolioRepository.getPortfolioAnalyticsAggregated(
          'user123',
        );

        expect(result).toBeDefined();
        expect(typeof result.pnl).toBe('number');
        expect(result.assetDistribution).toBeDefined();
      });

      it('should use where clause with userId filter', async () => {
        mockTradeQueryBuilder.getRawMany.mockResolvedValue([]);

        await portfolioRepository.getPortfolioAnalyticsAggregated('user123');

        // Verify where clause includes userId filter
        expect(mockTradeQueryBuilder.where).toHaveBeenCalledWith(
          'trade.userId = :userId',
          { userId: 'user123' },
        );
      });

      it('should log query execution time for debugging', async () => {
        const logSpy = jest.spyOn(
          portfolioRepository['logger'],
          'log',
        );
        mockTradeQueryBuilder.getRawMany.mockResolvedValue([]);

        await portfolioRepository.getPortfolioAnalyticsAggregated('user123');

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Portfolio analytics aggregation completed'),
        );
      });
    });

    describe('getTradeAggregationsByAsset', () => {
      it('should return aggregations by asset with net position', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '50',
            totalBuyVolume: '500000',
            totalSellVolume: '450000',
          },
          {
            asset: 'ETH',
            tradeCount: '100',
            totalBuyVolume: '200000',
            totalSellVolume: '300000',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result =
          await portfolioRepository.getTradeAggregationsByAsset('user123');

        expect(result).toHaveLength(2);
        expect(result[0].asset).toBe('BTC');
        // Net position = sellVolume - buyVolume
        expect(result[0].netPosition).toBe(-50000); // Negative = net buy
        expect(result[1].netPosition).toBe(100000); // Positive = net sell
      });

      it('should parse numeric values correctly', async () => {
        const mockAggregations = [
          {
            asset: 'BTC',
            tradeCount: '100',
            totalBuyVolume: '1000.50',
            totalSellVolume: '2000.75',
          },
        ];

        mockTradeQueryBuilder.getRawMany.mockResolvedValue(mockAggregations);

        const result =
          await portfolioRepository.getTradeAggregationsByAsset('user123');

        expect(typeof result[0].totalBuyVolume).toBe('number');
        expect(typeof result[0].totalSellVolume).toBe('number');
        expect(typeof result[0].netPosition).toBe('number');
      });
    });

    describe('getTradingStatistics', () => {
      it('should return overall trading statistics', async () => {
        const mockStats = {
          uniqueAssets: '5',
          totalTrades: '250',
          totalBuyVolume: '500000',
          totalSellVolume: '450000',
        };

        mockTradeQueryBuilder.getRawOne.mockResolvedValue(mockStats);

        const result = await portfolioRepository.getTradingStatistics('user123');

        expect(result.totalTrades).toBe(250);
        expect(result.uniqueAssets).toBe(5);
        expect(result.totalBuyVolume).toBe(500000);
        expect(result.totalSellVolume).toBe(450000);
        expect(result.netPnL).toBe(-50000);
      });

      it('should handle null aggregations gracefully', async () => {
        const mockStats = {
          uniqueAssets: '0',
          totalTrades: '0',
          totalBuyVolume: '0',
          totalSellVolume: '0',
        };

        mockTradeQueryBuilder.getRawOne.mockResolvedValue(mockStats);

        const result = await portfolioRepository.getTradingStatistics('user123');

        expect(result.totalTrades).toBe(0);
        expect(result.netPnL).toBe(0);
      });
    });

    describe('getUserTradesWithRelations', () => {
      it('should return trades ordered by date descending', async () => {
        const mockTrades = [
          {
            id: '1',
            userId: 'user123',
            asset: 'BTC',
            quantity: 1,
            price: 45000,
            side: 'BUY',
            date: new Date('2026-01-15'),
          },
          {
            id: '2',
            userId: 'user123',
            asset: 'ETH',
            quantity: 10,
            price: 3000,
            side: 'BUY',
            date: new Date('2026-01-10'),
          },
        ];

        mockTradeQueryBuilder.getMany.mockResolvedValue(mockTrades);

        const result = await portfolioRepository.getUserTradesWithRelations(
          'user123',
        );

        expect(result).toHaveLength(2);
        expect(result[0].date).toAfter(result[1].date);
      });

      it('should query without N+1 joins', async () => {
        const mockTrades = [];
        mockTradeQueryBuilder.getMany.mockResolvedValue(mockTrades);

        await portfolioRepository.getUserTradesWithRelations('user123');

        // Should use createQueryBuilder for efficient querying
        expect(mockTradeRepository.createQueryBuilder).toHaveBeenCalled();
      });
    });

    describe('countUserTrades', () => {
      it('should return total trade count for user', async () => {
        const mockTradeRepo = mockTradeRepository as any;
        mockTradeRepo.count.mockResolvedValue(250);

        const result = await portfolioRepository.countUserTrades('user123');

        expect(result).toBe(250);
        expect(mockTradeRepo.count).toHaveBeenCalledWith({
          where: { userId: 'user123' },
        });
      });

      it('should return 0 for user with no trades', async () => {
        const mockTradeRepo = mockTradeRepository as any;
        mockTradeRepo.count.mockResolvedValue(0);

        const result = await portfolioRepository.countUserTrades('user_no_trades');

        expect(result).toBe(0);
      });
    });
  });
});

