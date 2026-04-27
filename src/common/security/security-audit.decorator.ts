import { SetMetadata } from '@nestjs/common';
import { AuditEventType } from './audit-log.entity';

export const SECURITY_AUDIT_KEY = 'securityAudit';

/**
 * Marks a controller method for automatic security event logging.
 * The SecurityAuditInterceptor will fire before/after the method.
 *
 * Usage:
 * @SecurityAudit(AuditEventType.LOGIN)
 * async login(@Body() dto: LoginDto) { ... }
 */
export const SecurityAudit = (eventType: AuditEventType) =>
  SetMetadata(SECURITY_AUDIT_KEY, eventType);
