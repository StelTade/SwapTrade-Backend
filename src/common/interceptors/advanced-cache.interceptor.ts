import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  CACHE_KEY_METADATA,
  INVALIDATE_CACHE_METADATA,
} from '../decorators/cache-key.decorator';
import { CacheStatisticsService } from '../services/cache-statistics.service';

/**
 * Advanced caching interceptor with TTL, key generation, and statistics
 */
@Injectable()
export class AdvancedCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdvancedCacheInterceptor.name);

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly reflector: Reflector,
    @Optional() private readonly cacheStats: CacheStatisticsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Skip caching if explicitly disabled
    const skipCache = this.reflector.get<boolean>(
      'skip_cache',
      context.getHandler(),
    );
    if (skipCache || !this.cacheManager) {
      return next.handle();
    }

    const cacheKey = this.getCacheKey(context);
    const cacheTTL = this.reflector.get<number>(
      'cache_ttl',
      context.getHandler(),
    );

    // Try to get from cache
    if (cacheKey) {
      try {
        const cachedValue = await this.cacheManager.get(cacheKey);
        if (cachedValue !== undefined && cachedValue !== null) {
          this.logger.debug(`Cache HIT for key: ${cacheKey}`);
          this.cacheStats?.recordHit(cacheKey);
          return of(cachedValue);
        }
        this.cacheStats?.recordMiss(cacheKey);
      } catch (error) {
        this.logger.warn(`Cache read error for key ${cacheKey}:`, error);
        this.cacheStats?.recordError(cacheKey, 'read');
      }
    }

    // Call the handler and cache the result
    return next.handle().pipe(
      tap(async (result) => {
        if (cacheKey && result !== undefined && result !== null) {
          try {
            const ttl = cacheTTL || 30; // Default 30 seconds
            await this.cacheManager.set(cacheKey, result, ttl * 1000);
            this.logger.debug(
              `Cached result for key: ${cacheKey} (TTL: ${ttl}s)`,
            );
          } catch (error) {
            this.logger.warn(`Cache write error for key ${cacheKey}:`, error);
            this.cacheStats?.recordError(cacheKey, 'write');
          }
        }

        // Invalidate related cache keys
        const invalidateKeys = this.reflector.get<string[]>(
          INVALIDATE_CACHE_METADATA,
          context.getHandler(),
        );
        if (invalidateKeys && invalidateKeys.length > 0) {
          await this.invalidateCacheKeys(invalidateKeys, context);
        }
      }),
      catchError((error) => {
        if (cacheKey) {
          this.cacheStats?.recordError(cacheKey, 'execution');
        }
        throw error;
      }),
    );
  }

  /**
   * Generate cache key from decorator or default pattern
   */
  private getCacheKey(context: ExecutionContext): string | null {
    const customKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (!customKey) {
      return null;
    }

    // Interpolate parameters into key template
    const request = context.switchToHttp().getRequest();
    return this.interpolateKey(customKey, {
      ...request.params,
      ...request.query,
      userId: request.user?.id,
    });
  }

  /**
   * Interpolate {{param}} placeholders in cache key
   */
  private interpolateKey(
    template: string,
    params: Record<string, any>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = params[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Invalidate cache keys with pattern support
   */
  private async invalidateCacheKeys(
    keys: string[],
    context: ExecutionContext,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const params = {
      ...request.params,
      ...request.query,
      userId: request.user?.id,
    };

    for (const keyPattern of keys) {
      try {
        if (keyPattern.includes('*')) {
          // Pattern-based invalidation
          await this.invalidateByPattern(keyPattern, params);
        } else {
          // Direct key invalidation
          const key = this.interpolateKey(keyPattern, params);
          await this.cacheManager.del(key);
          this.logger.debug(`Invalidated cache key: ${key}`);
          this.cacheStats?.recordInvalidation(key);
        }
      } catch (error) {
        this.logger.warn(`Cache invalidation error for pattern ${keyPattern}:`, error);
      }
    }
  }

  /**
   * Pattern-based cache invalidation (for Redis stores)
   */
  private async invalidateByPattern(
    pattern: string,
    params: Record<string, any>,
  ): Promise<void> {
    const interpolatedPattern = this.interpolateKey(pattern, params);
    // Note: Pattern invalidation requires Redis support
    // For now, log a warning if pattern contains wildcards
    if (interpolatedPattern.includes('*')) {
      this.logger.warn(
        `Pattern-based invalidation requires Redis store: ${interpolatedPattern}`,
      );
    }
  }
}
