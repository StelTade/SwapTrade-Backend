import { ConfigService } from '../../config/config.service';
import * as redisStoreFactory from 'cache-manager-redis-store';

export async function redisStore(configService: ConfigService) {
  const redisConfig = configService.redis;

  return {
    store: redisStoreFactory,
    host: redisConfig.host,
    port: redisConfig.port,
    username: redisConfig.username,
    password: redisConfig.password,
    db: redisConfig.db,
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