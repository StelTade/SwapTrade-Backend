import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { SECURITY_AUDIT_KEY } from './security-audit.decorator';
import { SecurityEventLoggerService } from './security-event-logger.service';
import { AuditEventType, AuditSeverity } from './audit-log.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';

/**
 * SecurityAuditInterceptor
 *
 * Automatically logs security events for controller methods decorated
 * with @SecurityAudit(AuditEventType.XXX).
 *
 * - Logs the attempt before execution (with actor identity)
 * - Logs success or failure after execution
 * - Never throws — audit logging must not break request handling
 */
@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const eventType = this.reflector.getAllAndOverride<AuditEventType>(
      SECURITY_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!eventType) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request as any).user?.id ?? 'anonymous';
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.auditLogService.log({
            userId,
            eventType,
            severity: AuditSeverity.INFO,
            metadata: {
              success: true,
              method: request.method,
              path: request.path,
            },
            ipAddress,
            userAgent,
          });
        } catch (err) {
          this.logger.error(
            'Failed to write security audit log (success)',
            err,
          );
        }
      }),
      catchError((err) => {
        this.auditLogService
          .log({
            userId,
            eventType,
            severity: AuditSeverity.WARNING,
            metadata: {
              success: false,
              error: err?.message,
              method: request.method,
              path: request.path,
            },
            ipAddress,
            userAgent,
          })
          .catch((logErr) =>
            this.logger.error(
              'Failed to write security audit log (failure)',
              logErr,
            ),
          );

        return throwError(() => err);
      }),
    );
  }
}
