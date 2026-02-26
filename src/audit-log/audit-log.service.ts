import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { createHash } from 'crypto';
import { NotificationService } from '../notification/notification.service';
import {
  AuditEventType,
  AuditLog,
  AuditSeverity,
} from 'src/common/security/audit-log.entity';

export interface CreateAuditLogDto {
  userId?: string;
  eventType: AuditEventType;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly notificationService: NotificationService,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const lastEntry = await this.auditLogRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    const previousChecksum = lastEntry?.checksum ?? 'GENESIS';
    const timestamp = new Date().toISOString();

    // Build checksum BEFORE saving
    const rawData = JSON.stringify({
      userId: dto.userId,
      eventType: dto.eventType,
      entityType: dto.entityType,
      entityId: dto.entityId,
      beforeState: dto.beforeState,
      afterState: dto.afterState,
      timestamp,
      previousChecksum,
    });

    const checksum = createHash('sha256').update(rawData).digest('hex');

    const entry = this.auditLogRepo.create({
      ...dto,
      severity: dto.severity ?? AuditSeverity.INFO,
      checksum,
      previousChecksum,
    });

    const saved = await this.auditLogRepo.save(entry);

    // Notify on suspicious activity or critical events
    if (
      dto.severity === AuditSeverity.CRITICAL ||
      dto.eventType === AuditEventType.SUSPICIOUS_ACTIVITY
    ) {
      await this.notificationService.notifyAdmins({
        title: `🚨 ${dto.eventType}`,
        body: `User ${dto.userId} triggered a ${dto.severity} event.`,
        metadata: dto.metadata,
      });
    }

    return saved;
  }

  // ─── Forensic Queries ───────────────────────────────────────────────

  async getByUser(userId: string, from?: Date, to?: Date): Promise<AuditLog[]> {
    const where: any = { userId };
    if (from && to) where.createdAt = Between(from, to);
    return this.auditLogRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  async getByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }

  async getSuspiciousActivity(from: Date, to: Date): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: {
        eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
        createdAt: Between(from, to),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Verifies the integrity of the entire audit log chain.
   * Returns entries where the chain is broken.
   */
  async verifyChainIntegrity(): Promise<{
    broken: AuditLog[];
    valid: boolean;
  }> {
    const logs = await this.auditLogRepo.find({ order: { createdAt: 'ASC' } });
    const broken: AuditLog[] = [];

    for (let i = 1; i < logs.length; i++) {
      if (logs[i].previousChecksum !== logs[i - 1].checksum) {
        broken.push(logs[i]);
        this.logger.warn(`Chain broken at log ID: ${logs[i].id}`);
      }
    }

    return { broken, valid: broken.length === 0 };
  }

  /**
   * Reconstruct the full activity timeline for a user.
   */
  async getUserTimeline(userId: string) {
    const logs = await this.getByUser(userId);
    return logs.map((log) => ({
      timestamp: log.createdAt,
      event: log.eventType,
      entity: `${log.entityType}:${log.entityId}`,
      severity: log.severity,
      delta: this.computeDelta(log.beforeState, log.afterState),
    }));
  }

  private computeDelta(
    before: Record<string, any>,
    after: Record<string, any>,
  ): Record<string, { from: any; to: any }> {
    if (!before || !after) return {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const delta: Record<string, { from: any; to: any }> = {};
    for (const key of keys) {
      if (before[key] !== after[key]) {
        delta[key] = { from: before[key], to: after[key] };
      }
    }
    return delta;
  }
}
