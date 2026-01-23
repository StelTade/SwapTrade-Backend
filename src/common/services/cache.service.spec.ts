import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setUserBalanceCache', () => {
    it('should cache user balances with correct TTL', async () => {
      const userId = '123';
      const balances = [{ asset: 'BTC', balance: 1 }];
      await service.setUserBalanceCache(userId, balances);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        `user_balances:${userId}`,
        balances,
        { ttl: 30 },
      );
    });
  });

  describe('getUserBalanceCache', () => {
    it('should retrieve user balances from cache', async () => {
      const userId = '123';
      const cachedBalances = [{ asset: 'BTC', balance: 1 }];
      (cacheManager.get as jest.MockedFunction<any>).mockResolvedValue(cachedBalances);
      
      const result = await service.getUserBalanceCache(userId);
      
      expect(cacheManager.get).toHaveBeenCalledWith(`user_balances:${userId}`);
      expect(result).toEqual(cachedBalances);
    });
  });

  describe('setMarketPriceCache', () => {
    it('should cache market prices with correct TTL', async () => {
      const asset = 'BTC';
      const price = { price: 45000, timestamp: '2023-01-01' };
      await service.setMarketPriceCache(asset, price);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        `market_price:${asset}`,
        price,
        { ttl: 300 },
      );
    });
  });

  describe('getMarketPriceCache', () => {
    it('should retrieve market prices from cache', async () => {
      const asset = 'BTC';
      const cachedPrice = { price: 45000, timestamp: '2023-01-01' };
      (cacheManager.get as jest.MockedFunction<any>).mockResolvedValue(cachedPrice);
      
      const result = await service.getMarketPriceCache(asset);
      
      expect(cacheManager.get).toHaveBeenCalledWith(`market_price:${asset}`);
      expect(result).toEqual(cachedPrice);
    });
  });

  describe('setPortfolioCache', () => {
    it('should cache portfolio with correct TTL', async () => {
      const userId = '123';
      const portfolio = { totalValue: 1000, assets: [] };
      await service.setPortfolioCache(userId, portfolio);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        `portfolio:${userId}`,
        portfolio,
        { ttl: 60 },
      );
    });
  });

  describe('getPortfolioCache', () => {
    it('should retrieve portfolio from cache', async () => {
      const userId = '123';
      const cachedPortfolio = { totalValue: 1000, assets: [] };
      (cacheManager.get as jest.MockedFunction<any>).mockResolvedValue(cachedPortfolio);
      
      const result = await service.getPortfolioCache(userId);
      
      expect(cacheManager.get).toHaveBeenCalledWith(`portfolio:${userId}`);
      expect(result).toEqual(cachedPortfolio);
    });
  });

  describe('invalidate methods', () => {
    it('should invalidate user balance cache', async () => {
      const userId = '123';
      await service.invalidateUserBalanceCache(userId);
      
      expect(cacheManager.del).toHaveBeenCalledWith(`user_balances:${userId}`);
    });

    it('should invalidate market price cache', async () => {
      const asset = 'BTC';
      await service.invalidateMarketPriceCache(asset);
      
      expect(cacheManager.del).toHaveBeenCalledWith(`market_price:${asset}`);
    });

    it('should invalidate portfolio cache', async () => {
      const userId = '123';
      await service.invalidatePortfolioCache(userId);
      
      expect(cacheManager.del).toHaveBeenCalledWith(`portfolio:${userId}`);
    });
  });
});