import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const cacheKey = this.generateCacheKey(context);
    const ttl = this.reflector.get<number>('cache_ttl', context.getHandler());

    if (!cacheKey) {
      return next.handle();
    }

    // Try to get from cache
    let value = await this.cacheManager.get(cacheKey);

    if (value !== undefined && value !== null) {
      // Return cached value as observable
      return of(value);
    }

    // Execute the original method
    return next.handle().pipe(
      map(async (result) => {
        // Cache the result
        if (result !== undefined && result !== null) {
          await this.cacheManager.set(cacheKey, result, ttl * 1000);
        }
        return result;
      }),
    );
  }

  private generateCacheKey(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Create a unique key based on controller, method, and request parameters
    const method = `${controller.name}.${handler.name}`;
    const params = JSON.stringify(request.params || {});
    const query = JSON.stringify(request.query || {});

    return `cache:${method}:${params}:${query}`;
  }
}