/**
 * Infrastructure Cache Module
 * Redis integration, cache-manager, multi-level caching
 *
 * Facade over src/common/cache/ — original implementation location
 */

export { InfrastructureCacheModule } from './cache.module';
export { CustomCacheModule } from '../../common/cache/cache.module';
export { CacheWarmingService } from '../../common/cache/cache-warming.service';
export { RedisPoolService } from '../../common/cache/redis-pool.service';
export { RedisMetricsService } from '../../common/cache/redis-metrics.service';
