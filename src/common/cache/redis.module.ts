import { Module } from '@nestjs/common';
import { RedisModule as IORedisModule } from '@nestjs-modules/ioredis';
import { RedisPoolService } from './redis-pool.service';
import { RedisMetricsService } from './redis-metrics.service';

/**
 * Redis Services Module
 * 
 * Provides Redis connection pooling and metrics collection.
 * Separated from CacheModule to ensure availability during
 * async module initialization.
 */
@Module({
  imports: [
    IORedisModule.forRoot({
      type: 'single',
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 0,
      },
    }, 'l1'),
    IORedisModule.forRoot({
      type: 'single',
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 1,
      },
    }, 'l2'),
    IORedisModule.forRoot({
      type: 'single',
      options: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 2,
      },
    }, 'l3'),
  ],
  providers: [RedisMetricsService, RedisPoolService],
  exports: [IORedisModule, RedisMetricsService, RedisPoolService],
})
export class RedisModule {}
