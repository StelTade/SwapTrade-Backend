import { ConfigService } from '@nestjs/config';
import * as redisStoreFactory from 'cache-manager-redis-store';

export async function redisStore(configService: ConfigService) {
  const host = configService.get<string>('cache.redis.host', 'localhost');
  const port = configService.get<number>('cache.redis.port', 6379);
  const username = configService.get<string>('cache.redis.username');
  const password = configService.get<string>('cache.redis.password');
  const db = configService.get<number>('cache.redis.db', 0);

  return {
    store: redisStoreFactory,
    host,
    port,
    username,
    password,
    db,
    // Add options for better performance
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
      // reconnect after
      return Math.min(options.attempt * 100, 3000);
    },
  };
}