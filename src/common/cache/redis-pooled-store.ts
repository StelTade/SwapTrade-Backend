import type Redis from 'ioredis';
import CircuitBreaker from 'opossum';
import { RedisPoolService } from './redis-pool.service';
import { RedisMetricsService } from './redis-metrics.service';
import { ConfigService } from '../../config/config.service';

/** cache-manager may pass TTL in ms */
const TTL_MS_TO_SEC = 1 / 1000;

/**
 * Custom cache-manager compatible store using ioredis pool + circuit breaker.
 * Implements get, set, del for use with NestJS CacheModule.
 */
export function createRedisPooledStore(
  poolService: RedisPoolService,
  metricsService: RedisMetricsService,
  configService: ConfigService,
): { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown, ttl?: number) => Promise<void>; del: (key: string) => Promise<void> } {
  const redis = configService.redis;
  const threshold = redis.circuitBreakerThreshold ?? 5;
  const resetTimeout = redis.circuitBreakerResetMs ?? 60000;

  const runWithBreaker = <T>(fn: () => Promise<T>): Promise<T> => {
    return breaker.fire(fn) as Promise<T>;
  };

  const breaker = new CircuitBreaker(
    async (fn: () => Promise<unknown>) => fn(),
    {
      timeout: 10000,
      errorThresholdPercentage: 100,
      volumeThreshold: threshold,
      resetTimeout,
    },
  );

  breaker.on('open', () => {
    metricsService.setCircuitBreakerState('open');
  });
  breaker.on('halfOpen', () => {
    metricsService.setCircuitBreakerState('halfOpen');
  });
  breaker.on('close', () => {
    metricsService.setCircuitBreakerState('closed');
  });
  breaker.on('fallback', () => {
    metricsService.recordCircuitBreakerFailure();
  });

  return {
    async get(key: string): Promise<unknown> {
      return runWithBreaker(async () => {
        return poolService.withClient(async (client: Redis) => {
          const val = await client.get(key);
          if (val === null) return undefined;
          try {
            return JSON.parse(val) as unknown;
          } catch {
            return val;
          }
        });
      });
    },

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      return runWithBreaker(async () => {
        return poolService.withClient(async (client: Redis) => {
          const serialized = typeof value === 'string' ? value : JSON.stringify(value);
          const ttlSec = ttl != null ? Math.ceil(ttl * TTL_MS_TO_SEC) : 0;
          if (ttlSec > 0) {
            await client.setex(key, ttlSec, serialized);
          } else {
            await client.set(key, serialized);
          }
        });
      });
    },

    async del(key: string): Promise<void> {
      return runWithBreaker(async () => {
        return poolService.withClient(async (client: Redis) => {
          await client.del(key);
        });
      });
    },
  };
}
