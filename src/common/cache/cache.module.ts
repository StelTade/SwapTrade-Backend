import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from './cache.provider';
import cacheConfig from '../config/cache.config';

@Module({
  imports: [
    ConfigModule.forFeature(cacheConfig),
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return await redisStore(configService);
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CustomCacheModule {}