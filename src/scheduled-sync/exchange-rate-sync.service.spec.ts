import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import { Cache } from 'cache-manager';

describe('ExchangeRateSyncService', () => {
  let service: ExchangeRateSyncService;
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
        ExchangeRateSyncService,
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

    service = module.get<ExchangeRateSyncService>(ExchangeRateSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = service.getStatus();
      
      expect(status).toHaveProperty('lastSync');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('url');
    });
  });

  describe('triggerSync', () => {
    it('should trigger manual sync', async () => {
      mockCacheManager.set.mockResolvedValue(undefined);
      
      const result = await service.triggerSync();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });
  });
});
