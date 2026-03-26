import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExchangeRateService } from './exchange-rate.service';
import { Cache } from 'cache-manager';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let mockCacheManager: jest.Mocked<Cache>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockReturnValue('https://api.example.com/rates'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRates', () => {
    it('should return cached rates if available', async () => {
      const cachedData = {
        rates: { EUR: 0.92, GBP: 0.79 },
        lastUpdated: new Date(),
        source: 'api',
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getRates();

      expect(result.base).toBe('USD');
      expect(result.rates).toEqual(cachedData.rates);
      expect(result.source).toBe('api');
    });

    it('should return fallback rates when cache is empty and fetch fails', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      // Mock fetch to fail
      const result = await service.getRates();

      expect(result.base).toBe('USD');
      expect(result.source).toBe('fallback');
      expect(result.rates).toBeDefined();
    });
  });

  describe('getRate', () => {
    it('should return specific currency rate', async () => {
      const cachedData = {
        rates: { EUR: 0.92, GBP: 0.79 },
        lastUpdated: new Date(),
        source: 'api',
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const rate = await service.getRate('EUR');

      expect(rate).toBe(0.92);
    });

    it('should return null for unknown currency', async () => {
      const cachedData = {
        rates: { EUR: 0.92, GBP: 0.79 },
        lastUpdated: new Date(),
        source: 'api',
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const rate = await service.getRate('XXX');

      expect(rate).toBeNull();
    });
  });

  describe('refresh', () => {
    it('should clear cache and fetch fresh rates', async () => {
      mockCacheManager.del.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.refresh();

      expect(mockCacheManager.del).toHaveBeenCalled();
      expect(result.base).toBe('USD');
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when cache is available', async () => {
      const cachedData = {
        rates: { EUR: 0.92 },
        lastUpdated: new Date(),
        source: 'api',
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const health = await service.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.source).toBe('api');
    });

    it('should return unhealthy status when no cache and no last update', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const health = await service.getHealth();

      expect(health.status).toBe('unhealthy');
    });
  });
});
