import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';

/**
 * Decorator to define cache key for a method
 * Supports dynamic key generation with parameter interpolation
 * 
 * @example
 * @CacheKey('user:portfolio:{{userId}}')
 * async getPortfolio(userId: string) { }
 */
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

/**
 * Decorator to invalidate related cache keys when method succeeds
 * 
 * @example
 * @InvalidateCacheKeys(['user:portfolio:{{userId}}', 'user:balance:*'])
 * async updateBalance(userId: string, amount: number) { }
 */
export const INVALIDATE_CACHE_METADATA = 'invalidate_cache_keys';
export const InvalidateCacheKeys = (keys: string[]) =>
  SetMetadata(INVALIDATE_CACHE_METADATA, keys);

/**
 * Decorator to skip cache for a method
 */
export const SkipCache = () => SetMetadata('skip_cache', true);
