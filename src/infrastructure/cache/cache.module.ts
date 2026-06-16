import { Module } from '@nestjs/common';
import { CustomCacheModule } from '../../common/cache/cache.module';

/**
 * Infrastructure Cache Facade Module
 *
 * Wraps the original CustomCacheModule from src/common/cache/.
 * Provides: CacheModule (NestJS), CacheService, CacheWarmingService,
 *           RedisPoolService, RedisMetricsService
 */
@Module({
  imports: [CustomCacheModule],
  exports: [CustomCacheModule],
})
export class InfrastructureCacheModule {}
