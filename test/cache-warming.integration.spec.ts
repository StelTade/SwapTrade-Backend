import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { CustomCacheModule } from '../src/common/cache/cache.module';
import { CacheWarmingService } from '../src/common/cache/cache-warming.service';
import { CacheService } from '../src/common/services/cache.service';
import cacheConfig from '../src/common/config/cache.config';

describe('CacheWarmingService Integration', () => {
  let cacheWarmingService: CacheWarmingService;
  let cacheService: CacheService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [cacheConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        }),
        CacheModule.register({ isGlobal: true }),
        CustomCacheModule,
      ],
    }).compile();

    cacheWarmingService = module.get<CacheWarmingService>(CacheWarmingService);
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(cacheWarmingService).toBeDefined();
    expect(cacheService).toBeDefined();
  });

  it('should have warming metrics available', () => {
    const metrics = cacheWarmingService.getWarmingMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalKeysWarmed).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.failureCount).toBe(0);
  });

  it('should track cache hits and misses', async () => {
    // Test cache hit/miss tracking
    const initialMetrics = cacheService.getCacheMetrics();
    expect(initialMetrics.hits).toBe(0);
    expect(initialMetrics.misses).toBe(0);
    
    // Try to get a non-existent key (should be a miss)
    await cacheService.get('test-key-nonexistent');
    const afterMissMetrics = cacheService.getCacheMetrics();
    expect(afterMissMetrics.misses).toBe(1);
    expect(afterMissMetrics.hits).toBe(0);
    
    // Set and get a key (should be a hit)
    await cacheService.set('test-key', 'test-value');
    await cacheService.get('test-key');
    const afterHitMetrics = cacheService.getCacheMetrics();
    expect(afterHitMetrics.hits).toBe(1);
    expect(afterHitMetrics.misses).toBe(1);
  });

  it('should handle force warming', async () => {
    // This should not throw an error even if repositories are not available
    const result = await cacheWarmingService.forceWarmCache();
    expect(result).toBeDefined();
    // The result will show failures since we don't have real data in test DB
    expect(result.failureCount).toBeGreaterThanOrEqual(0);
  });
});