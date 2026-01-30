import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from './cache.provider';
import cacheConfig from '../config/cache.config';
import { CacheWarmingService } from './cache-warming.service';
import { CacheController } from './cache.controller';
import { Balance } from '../../balance/balance.entity';
import { MarketData } from '../../trading/entities/market-data.entity';

@Module({
  imports: [
    ConfigModule.forFeature(cacheConfig),
    TypeOrmModule.forFeature([Balance, MarketData]),
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return await redisStore(configService);
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [CacheController],
  providers: [CacheWarmingService],
  exports: [NestCacheModule, CacheWarmingService],
})
export class CustomCacheModule {}