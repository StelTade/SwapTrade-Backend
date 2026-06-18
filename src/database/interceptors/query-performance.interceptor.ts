import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryPerformanceService } from '../services/query-performance.service';

@Injectable()
export class QueryPerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(QueryPerformanceInterceptor.name);

  constructor(
    private readonly queryPerformanceService: QueryPerformanceService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Log slow requests that might be caused by database queries
        if (duration > 100) {
          this.logger.warn(
            `Slow request detected: ${request.method} ${request.url} took ${duration}ms`,
            {
              method: request.method,
              url: request.url,
              duration,
              userId: request.user?.id,
              userAgent: request.headers['user-agent'],
            },
          );
        }
      }),
    );
  }
}
