import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BalanceService } from '../src/balance/balance.service';
import { PortfolioService } from '../src/portfolio/portfolio.service';
import { CacheService } from '../src/common/services/cache.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from '../src/balance/balance.entity';
import { BalanceAudit } from '../src/balance/balance-audit.entity';
import { TradeEntity } from '../src/portfolio/entities/trade.entity';
import { Trade } from '../src/trading/entities/trade.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Cache Integration Tests', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let balanceService: BalanceService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Balance, BalanceAudit, TradeEntity, Trade],
          synchronize: true,
        }),
        CacheModule.register({ isGlobal: true }),
      ],
      providers: [
        CacheService,
        BalanceService,
        PortfolioService,
        {
          provide: getRepositoryToken(Balance),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(BalanceAudit),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(TradeEntity),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Trade),
          useClass: Repository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cacheService = app.get<CacheService>(CacheService);
    balanceService = app.get<BalanceService>(BalanceService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.del('user_balances:test-user');
  });

  describe('Cache Hit/Miss Scenarios', () => {
    it('should cache user balances on first call and return cached value on second call', async () => {
      // Mock repository to return test data
      const mockBalances = [
        { asset: 'BTC', balance: 1.5, userId: 'test-user' },
        { asset: 'ETH', balance: 10, userId: 'test-user' },
      ];
      
      jest.spyOn((balanceService as any).balanceRepository, 'find').mockResolvedValue(mockBalances);

      // First call - should query database and cache result
      const result1 = await balanceService.getUserBalances('test-user');
      
      // Second call - should return cached result
      const result2 = await balanceService.getUserBalances('test-user');
      
      // Results should be the same
      expect(result1).toEqual(result2);
      
      // Verify repository was only called once (due to caching)
      expect((balanceService as any).balanceRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should expire cache after TTL', async () => {
      const mockBalances = [
        { asset: 'BTC', balance: 1.5, userId: 'test-user' },
      ];
      
      jest.spyOn((balanceService as any).balanceRepository, 'find').mockResolvedValue(mockBalances);

      // First call - populate cache
      await balanceService.getUserBalances('test-user');
      
      // Manually clear the cache to simulate TTL expiration
      await cacheService.invalidateUserBalanceCache('test-user');
      
      // Second call - should query database again
      const result2 = await balanceService.getUserBalances('test-user');
      
      // Verify repository was called twice (no caching)
      expect((balanceService as any).balanceRepository.find).toHaveBeenCalledTimes(2);
      expect(result2).toEqual([{ asset: 'BTC', balance: 1.5 }]);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate user balance cache when balance changes', async () => {
      const mockBalances = [
        { asset: 'BTC', balance: 1.5, userId: 'test-user' },
      ];
      
      jest.spyOn((balanceService as any).balanceRepository, 'find').mockResolvedValue(mockBalances);

      // Populate cache
      await balanceService.getUserBalances('test-user');
      
      // Verify cache was populated by checking that subsequent calls don't hit DB
      await balanceService.getUserBalances('test-user');
      expect((balanceService as any).balanceRepository.find).toHaveBeenCalledTimes(1);
      
      // Simulate balance change (which should trigger cache invalidation)
      await (balanceService as any).cacheService.invalidateBalanceRelatedCaches('test-user');
      
      // Next call should hit database again
      await balanceService.getUserBalances('test-user');
      expect((balanceService as any).balanceRepository.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('Fallback to Database', () => {
    it('should fall back to database if cache is unavailable', async () => {
      const mockBalances = [
        { asset: 'BTC', balance: 1.5, userId: 'test-user' },
      ];
      
      jest.spyOn((balanceService as any).balanceRepository, 'find').mockResolvedValue(mockBalances);
      
      // Mock cache to throw error
      jest.spyOn(cacheService, 'getUserBalanceCache').mockRejectedValue(new Error('Cache unavailable'));
      jest.spyOn(cacheService, 'setUserBalanceCache').mockRejectedValue(new Error('Cache unavailable'));

      // Should still work despite cache errors
      const result = await balanceService.getUserBalances('test-user');
      
      expect(result).toEqual([{ asset: 'BTC', balance: 1.5 }]);
      expect((balanceService as any).balanceRepository.find).toHaveBeenCalledTimes(1);
    });
  });
});