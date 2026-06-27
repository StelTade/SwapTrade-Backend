import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as redisStoreFactory from 'cache-manager-redis-store';
import cacheConfig from '../config/cache.config';
import { CacheWarmingService } from './cache-warming.service';
import { AdvancedCacheWarmingService } from './cache-warming-advanced.service';
import { CacheController } from './cache.controller';
import { CacheService } from '../services/cache.service';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { RedisModule } from './redis.module';

@Module({
  imports: [
    ConfigModule.forFeature(cacheConfig),
    TypeOrmModule.forFeature([VirtualAsset]),
    RedisModule,
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (_configService: ConfigService) => {
        const redisHost =
          _configService.get<string>('REDIS_HOST') || 'localhost';
        const redisPort = _configService.get<number>('REDIS_PORT') || 6379;
        const redisPassword = _configService.get<string>('REDIS_PASSWORD');
        const redisDb = _configService.get<number>('REDIS_DB') || 0;
        const ttl = (_configService.get<number>('CACHE_TTL') || 300) * 1000;

        return {
          store: redisStoreFactory,
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
          ttl,
          retry_strategy: (options: any) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              console.log('Redis connection refused');
              return new Error('Redis server refused connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              console.log('Retry time exhausted');
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              console.log('Attempt number exceeded');
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          },
        };
      },
    }),
  ],
  controllers: [CacheController],
  providers: [CacheService, CacheWarmingService, AdvancedCacheWarmingService],
  exports: [
    NestCacheModule,
    CacheService,
    CacheWarmingService,
    AdvancedCacheWarmingService,
    RedisModule,
  ],
})
export class CustomCacheModule {}
