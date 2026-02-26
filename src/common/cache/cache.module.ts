import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from './cache.provider';
import cacheConfig from '../config/cache.config';
import { CacheWarmingService } from './cache-warming.service';
import { CacheController } from './cache.controller';
import { CacheService } from '../services/cache.service';
import { Balance } from '../../balance/balance.entity';
import { MarketData } from '../../trading/entities/market-data.entity';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';
import { ConfigService as AppConfigService } from '../../config/config.service';
import { RedisPoolService } from './redis-pool.service';
import { RedisMetricsService } from './redis-metrics.service';
import { createRedisPooledStore } from './redis-pooled-store';

@Module({
  imports: [
    ConfigModule.forFeature(cacheConfig),
    TypeOrmModule.forFeature([Balance, MarketData, VirtualAsset]),
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (
        _configService: ConfigService,
        appConfigService: AppConfigService,
        poolService: RedisPoolService,
        metricsService: RedisMetricsService,
      ) => {
        const usePool =
          (appConfigService.redis.poolMin ?? 0) > 0 && (appConfigService.redis.poolMax ?? 0) > 0;
        if (usePool) {
          const store = createRedisPooledStore(poolService, metricsService, appConfigService);
          const ttl = (appConfigService.cache?.ttl ?? 300) * 1000;
          return { store, ttl };
        }
        return await redisStore(appConfigService);
      },
      inject: [ConfigService, AppConfigService, RedisPoolService, RedisMetricsService],
    }),
  ],
  controllers: [CacheController],
  providers: [RedisMetricsService, RedisPoolService, CacheService, CacheWarmingService],
  exports: [NestCacheModule, CacheService, CacheWarmingService, RedisPoolService, RedisMetricsService],
})
export class CustomCacheModule {}