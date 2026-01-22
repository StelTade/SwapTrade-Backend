import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioService } from './portfolio.service';
import { Trade } from '../trading/entities/trade.entity';
import { Balance } from 'src/balance/balance.entity';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let balanceRepository: Repository<Balance>;
  let tradeRepository: Repository<Trade>;

  const mockBalanceRepository = {
    find: jest.fn(),
  };

  const mockTradeRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        {
          provide: getRepositoryToken(Balance),
          useValue: mockBalanceRepository,
        },
        {
          provide: getRepositoryToken(Trade),
          useValue: mockTradeRepository,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    balanceRepository = module.get<Repository<Balance>>(
      getRepositoryToken(Balance),
    );
    tradeRepository = module.get<Repository<Trade>>(getRepositoryToken(Trade));

    // Clear cache before each test
    service.clearPriceCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      mockBalanceRepository.find.mockResolvedValue(mockBalances);
      mockTradeRepository.find.mockResolvedValue([]);

      const result = await service.getPortfolioRisk(1);

      // USDT has low volatility (5%)
      expect(result.volatilityEstimate).toBe(5);
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
});
