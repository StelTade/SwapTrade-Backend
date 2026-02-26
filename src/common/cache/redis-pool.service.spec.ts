import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '../../config/config.service';
import { RedisPoolService } from './redis-pool.service';
import { RedisMetricsService } from './redis-metrics.service';

describe('RedisPoolService', () => {
  let service: RedisPoolService;
  let metricsService: RedisMetricsService;
  let configService: ConfigService;

  const mockConfigService = {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      poolMin: 0,
      poolMax: 2,
      backoffBaseMs: 10,
      backoffMaxMs: 100,
      backoffMaxAttempts: 2,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisPoolService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        RedisMetricsService,
      ],
    }).compile();

    service = module.get<RedisPoolService>(RedisPoolService);
    metricsService = module.get<RedisMetricsService>(RedisMetricsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await service?.onModuleDestroy?.();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return pool metrics with available and inUse', () => {
      const metrics = service.getMetrics();
      expect(metrics).toHaveProperty('poolSize');
      expect(metrics).toHaveProperty('available');
      expect(metrics).toHaveProperty('inUse');
      expect(metrics).toHaveProperty('totalAcquired');
      expect(metrics).toHaveProperty('totalReleased');
      expect(metrics).toHaveProperty('totalRetries');
      expect(metrics).toHaveProperty('totalConnectionErrors');
    });
  });

  describe('pool exhaustion', () => {
    it('should throw when pool max is 0 and acquire is called', async () => {
      const zeroPoolConfig = {
        ...mockConfigService,
        redis: { ...mockConfigService.redis, poolMin: 0, poolMax: 0 },
      };
      const mod = await Test.createTestingModule({
        providers: [
          RedisPoolService,
          { provide: ConfigService, useValue: zeroPoolConfig },
          RedisMetricsService,
        ],
      }).compile();
      const poolSvc = mod.get<RedisPoolService>(RedisPoolService);
      await expect(poolSvc.acquire()).rejects.toThrow(/pool exhausted/);
      await poolSvc.onModuleDestroy();
    });
  });
});
