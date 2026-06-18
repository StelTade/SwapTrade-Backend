import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { INTERNAL_ONLY_KEY } from '../decorators/internal-only.decorator';

/**
 * ServiceBoundaryInterceptor
 *
 * Logs every request to @InternalOnly() endpoints so that
 * accidental public exposure is always traceable in the logs.
 *
 * Unlike InternalServiceGuard (which enforces the boundary),
 * this interceptor runs after the guard passes and records
 * which internal service methods were accessed, by whom, and when.
 */
@Injectable()
export class ServiceBoundaryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ServiceBoundaryInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isInternal = this.reflector.getAllAndOverride<boolean>(
      INTERNAL_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isInternal) {
      const req = context.switchToHttp().getRequest();
      this.logger.verbose(
        `[ServiceBoundary] Internal endpoint accessed | ${req.method} ${req.path} | ip=${req.ip}`,
      );
    }

    return next.handle();
  }
}
