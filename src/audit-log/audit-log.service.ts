import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { createHash } from 'crypto';
import {
  AuditEventType,
  AuditLog,
  AuditSeverity,
} from 'src/common/security/audit-log.entity';
import { AuditFilterDto } from './dto/audit-filter.dto';

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

  /**
   * Get audit trail with filtering and pagination
   */
  async getAuditTrail(filter: AuditFilterDto): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: any = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.severity) where.severity = filter.severity;
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.ipAddress) where.ipAddress = filter.ipAddress;
    if (filter.requestId) where.requestId = filter.requestId;

    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = new Date(filter.fromDate);
      if (filter.toDate) where.createdAt.lte = new Date(filter.toDate);
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((filter.page || 1) - 1) * (filter.limit || 50),
      take: filter.limit || 50,
    });

    const totalPages = Math.ceil(total / (filter.limit || 50));

    return {
      data,
      total,
      page: filter.page || 1,
      limit: filter.limit || 50,
      totalPages,
    };
  }

  /**
   * Export audit log to CSV format
   */
  async exportAuditLog(dateRange: { from: Date; to: Date }): Promise<string> {
    const logs = await this.auditLogRepo.find({
      where: {
        createdAt: Between(dateRange.from, dateRange.to),
      },
      order: { createdAt: 'ASC' },
    });

    const headers = [
      'ID',
      'User ID',
      'Event Type',
      'Severity',
      'Entity Type',
      'Entity ID',
      'Before State',
      'After State',
      'Metadata',
      'IP Address',
      'User Agent',
      'Request ID',
      'Checksum',
      'Previous Checksum',
      'Created At',
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        log.userId || '',
        log.eventType,
        log.severity,
        log.entityType || '',
        log.entityId || '',
        this.escapeCSV(JSON.stringify(log.beforeState || {})),
        this.escapeCSV(JSON.stringify(log.afterState || {})),
        this.escapeCSV(JSON.stringify(log.metadata || {})),
        log.ipAddress || '',
        this.escapeCSV(log.userAgent || ''),
        log.requestId || '',
        log.checksum,
        log.previousChecksum || '',
        log.createdAt.toISOString(),
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    }

    return csvRows.join('\n');
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }
}
