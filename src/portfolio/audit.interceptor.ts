import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { AUDIT_ACTION_KEY, AUDIT_RESOURCE_KEY } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditLogger: AuditLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const resource = this.reflector.get<string>(AUDIT_RESOURCE_KEY, context.getHandler());

    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = request.ip || request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap((data) => {
        this.auditLogger.log({
          userId: user?.userId || user?.id || 'ANONYMOUS',
          action,
          resource,
          resourceId: data?.id || request.params?.id,
          newValue: request.method !== 'GET' ? data : undefined, // Log result for non-GET
          metadata: { method: request.method, url: request.url, query: request.query, body: request.body },
          ip,
          userAgent,
          status: 'SUCCESS',
        });
      }),
      catchError((err) => {
        this.auditLogger.log({
          userId: user?.userId || user?.id || 'ANONYMOUS',
          action,
          resource,
          resourceId: request.params?.id,
          metadata: { error: err.message, method: request.method, url: request.url, body: request.body },
          ip,
          userAgent,
          status: 'FAILURE',
        });
        return throwError(() => err);
      }),
    );
  }
}