import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUTH_EVENTS } from '../auth.service';
import { USER_EVENTS } from '../../user/user.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  AuditEventType,
  AuditSeverity,
} from '../../common/security/audit-log.entity';

/**
 * Listens to auth and user identity events and writes structured audit log entries.
 * This keeps AuditLogService decoupled from AuthService.
 */
@Injectable()
export class AuthAuditListener {
  private readonly logger = new Logger(AuthAuditListener.name);

  constructor(
    @Optional() private readonly auditLogService?: AuditLogService,
  ) {}

  @OnEvent(AUTH_EVENTS.USER_REGISTERED)
  async onUserRegistered(payload: {
    authId: string;
    userId: string;
    email: string;
    correlationId?: string;
  }) {
    await this.log({
      userId: payload.userId,
      eventType: AuditEventType.REGISTER,
      severity: AuditSeverity.INFO,
      entityType: 'User',
      entityId: payload.userId,
      metadata: { email: payload.email },
      requestId: payload.correlationId,
    });
  }

  @OnEvent(AUTH_EVENTS.USER_LOGGED_IN)
  async onUserLoggedIn(payload: {
    authId: string;
    userId: string;
    email: string;
    ipAddress?: string;
  }) {
    await this.log({
      userId: payload.userId,
      eventType: AuditEventType.LOGIN,
      severity: AuditSeverity.INFO,
      entityType: 'Auth',
      entityId: payload.authId,
      ipAddress: payload.ipAddress,
    });
  }

  @OnEvent(AUTH_EVENTS.USER_LOGGED_OUT)
  async onUserLoggedOut(payload: {
    authId: string;
    userId?: string;
    email: string;
  }) {
    await this.log({
      userId: payload.userId,
      eventType: AuditEventType.LOGOUT,
      severity: AuditSeverity.INFO,
      entityType: 'Auth',
      entityId: payload.authId,
    });
  }

  @OnEvent(AUTH_EVENTS.PASSWORD_CHANGED)
  async onPasswordChanged(payload: { authId: string; email: string }) {
    await this.log({
      eventType: AuditEventType.PASSWORD_CHANGED,
      severity: AuditSeverity.WARNING,
      entityType: 'Auth',
      entityId: payload.authId,
      metadata: { email: payload.email },
    });
  }

  @OnEvent(AUTH_EVENTS.PASSWORD_RESET_REQUESTED)
  async onPasswordResetRequested(payload: { authId: string; email: string }) {
    await this.log({
      eventType: AuditEventType.PASSWORD_RESET_REQUESTED,
      severity: AuditSeverity.INFO,
      entityType: 'Auth',
      entityId: payload.authId,
      metadata: { email: payload.email },
    });
  }

  @OnEvent(AUTH_EVENTS.ACCOUNT_LOCKED)
  async onAccountLocked(payload: {
    authId: string;
    email: string;
    lockedUntil: Date;
  }) {
    await this.log({
      eventType: AuditEventType.ACCOUNT_LOCKED,
      severity: AuditSeverity.WARNING,
      entityType: 'Auth',
      entityId: payload.authId,
      metadata: { email: payload.email, lockedUntil: payload.lockedUntil },
    });
  }

  @OnEvent(USER_EVENTS.STATUS_CHANGED)
  async onUserStatusChanged(payload: {
    userId: string;
    email: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
  }) {
    const eventTypeMap: Record<string, AuditEventType> = {
      ACTIVE: AuditEventType.ACCOUNT_ACTIVATED,
      SUSPENDED: AuditEventType.ACCOUNT_SUSPENDED,
      INACTIVE: AuditEventType.ACCOUNT_DEACTIVATED,
    };

    await this.log({
      userId: payload.userId,
      eventType: eventTypeMap[payload.newStatus] ?? AuditEventType.ACCOUNT_ACTIVATED,
      severity:
        payload.newStatus === 'SUSPENDED' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      entityType: 'User',
      entityId: payload.userId,
      beforeState: { status: payload.previousStatus },
      afterState: { status: payload.newStatus },
      metadata: { reason: payload.reason },
    });
  }

  // ─── Helper ────────────────────────────────────────────────────────────────

  private async log(args: Parameters<AuditLogService['log']>[0]) {
    if (!this.auditLogService) {
      this.logger.debug('AuditLogService not available — skipping audit log entry');
      return;
    }
    try {
      await this.auditLogService.log(args);
    } catch (err) {
      this.logger.error('Failed to write audit log entry', err);
    }
  }
}
