import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import {
  INVALIDATE_CACHE_METADATA,
} from '../decorators/cache-key.decorator';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';

/**
 * Intercepts method calls decorated with @InvalidateCacheKeys
 * and performs cache invalidation after successful execution.
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const patterns: string[] | undefined = this.reflector.get(
      INVALIDATE_CACHE_METADATA,
      context.getHandler(),
    );

    if (!patterns || patterns.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        // Extract args from handler to resolve {{param}} placeholders
        const args = context.getArgs();
        const params = this.extractParams(args);

        const resolvedKeys = patterns.map((p) =>
          this.cacheInvalidationService.buildKey(p, params),
        );

        this.logger.debug(`Post-call invalidation: ${resolvedKeys.join(', ')}`);
        await this.cacheInvalidationService.invalidateBatch(resolvedKeys);
      }),
    );
  }

  private extractParams(args: any[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const arg of args) {
      if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
        Object.assign(params, arg);
      } else if (typeof arg === 'string' || typeof arg === 'number') {
        // Positional primitive — commonly userId is first arg
        if (!params['userId']) params['userId'] = String(arg);
      }
    }

    return params;
  }
}