import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService, CreateAuditLogDto } from '../../audit-log/audit-log.service';
import { AuditEventType, AuditSeverity } from './audit-log.entity';

/**
 * SecurityEventLoggerService
 *
 * A centralised, strongly-typed service for logging security-critical actions.
 * All methods delegate to AuditLogService so every event is written to the
 * tamper-evident audit log chain.
 *
 * Implements issue #350:
 * - KYC updates
 * - Role changes
 * - Governance actions
 * - Auth events (login / logout / MFA)
 * - Sensitive data access
 */
@Injectable()
export class SecurityEventLoggerService {
  private readonly logger = new Logger(SecurityEventLoggerService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  // ─── KYC ────────────────────────────────────────────────────────────────────

  /**
   * Log a KYC record update, including before/after state for auditability.
   */
  async logKycUpdate(
    actorId: string,
    targetUserId: string,
    before: Record<string, any>,
    after: Record<string, any>,
    ipAddress?: string,
  ): Promise<void> {
    await this.emit({
      userId: actorId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY, // re-use closest type; extend enum as needed
      severity: AuditSeverity.WARNING,
      entityType: 'kyc',
      entityId: targetUserId,
      beforeState: before,
      afterState: after,
      metadata: { action: 'KYC_UPDATE', targetUserId },
      ipAddress,
    });
    this.logger.log(`[Security] KYC updated: actor=${actorId} target=${targetUserId}`);
  }

  // ─── Role changes ──────────────────────────────────────────────────────────

  /**
   * Log a role assignment / revocation.
   */
  async logRoleChange(
    actorId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.emit({
      userId: actorId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.CRITICAL,
      entityType: 'user',
      entityId: targetUserId,
      beforeState: { role: oldRole },
      afterState: { role: newRole },
      metadata: { action: 'ROLE_CHANGE', actorId, targetUserId, oldRole, newRole },
      ipAddress,
    });
    this.logger.warn(
      `[Security] Role changed: actor=${actorId} target=${targetUserId} ${oldRole} → ${newRole}`,
    );
  }

  // ─── Governance ────────────────────────────────────────────────────────────

  /**
   * Log a governance action (proposal creation, voting, parameter change, etc.).
   */
  async logGovernanceAction(
    actorId: string,
    actionType: string,
    details: Record<string, any>,
    ipAddress?: string,
  ): Promise<void> {
    await this.emit({
      userId: actorId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.WARNING,
      entityType: 'governance',
      metadata: { action: actionType, ...details },
      ipAddress,
    });
    this.logger.log(`[Security] Governance action: actor=${actorId} action=${actionType}`);
  }

  // ─── Auth events ──────────────────────────────────────────────────────────

  /**
   * Log an authentication event (login success/failure, logout, MFA).
   */
  async logAuthEvent(
    userId: string,
    eventType: AuditEventType,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.emit({
      userId,
      eventType,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      entityType: 'auth',
      metadata: { success },
      ipAddress,
      userAgent,
    });
    this.logger.log(
      `[Security] Auth event: userId=${userId} type=${eventType} success=${success} ip=${ipAddress}`,
    );
  }

  // ─── Sensitive data access ─────────────────────────────────────────────────

  /**
   * Log access to sensitive data (PII, private keys, admin reports, etc.).
   */
  async logSensitiveDataAccess(
    actorId: string,
    entityType: string,
    entityId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.emit({
      userId: actorId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.INFO,
      entityType,
      entityId,
      metadata: { action: 'SENSITIVE_DATA_ACCESS', entityType, entityId },
      ipAddress,
    });
    this.logger.log(
      `[Security] Sensitive data accessed: actor=${actorId} entity=${entityType}/${entityId}`,
    );
  }

  // ─── Private helper ───────────────────────────────────────────────────────

  private async emit(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.auditLogService.log(dto);
    } catch (err) {
      // Never let audit logging crash the request; log locally instead
      this.logger.error('[Security] Failed to write audit log entry', err);
    }
  }
}
