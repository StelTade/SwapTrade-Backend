import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
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

export const AUDIT_WORM_SINK = 'AUDIT_WORM_SINK';

/**
 * Append-only sink for critical audit records (issue #423). Implementations
 * must never rewrite or delete previously appended lines — e.g. S3 Object
 * Lock / WORM storage in production.
 */
export interface WormSink {
  append(entry: {
    id: string;
    checksum: string;
    previousChecksum: string | null;
    eventType: string;
    createdAt: Date;
    payload: string;
  }): Promise<void>;
}

export type ExportFormat = 'csv' | 'json';

export interface SignedExportLink {
  url: string;
  expiresAt: Date;
  format: ExportFormat;
}

interface ExportTokenPayload {
  from: string;
  to: string;
  format: ExportFormat;
  exp: number; // unix seconds
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @Optional()
    @Inject(AUDIT_WORM_SINK)
    private readonly wormSink?: WormSink,
  ) {}

  // ─── Checksums ──────────────────────────────────────────────────────

  /** Deterministic checksum over the immutable fields of one entry. */
  computeChecksum(
    dto: CreateAuditLogDto,
    timestamp: string,
    previousChecksum: string,
  ): string {
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
    return createHash('sha256').update(rawData).digest('hex');
  }

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const lastEntry = await this.auditLogRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    const previousChecksum = lastEntry?.checksum ?? 'GENESIS';
    const timestamp = new Date().toISOString();
    const checksum = this.computeChecksum(dto, timestamp, previousChecksum);

    const entry = this.auditLogRepo.create({
      ...dto,
      severity: dto.severity ?? AuditSeverity.INFO,
      checksum,
      previousChecksum,
    });

    const saved = await this.auditLogRepo.save(entry);

    if (this.wormSink && saved?.id) {
      try {
        await this.wormSink.append({
          id: saved.id,
          checksum: saved.checksum,
          previousChecksum: saved.previousChecksum,
          eventType: saved.eventType,
          createdAt: saved.createdAt,
          payload: JSON.stringify(saved),
        });
      } catch (err) {
        // WORM failures must not lose the DB record but must be loud.
        this.logger.error(
          `WORM sink append failed for audit entry ${saved.id}: ${err}`,
        );
      }
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
   * Verifies the integrity of the entire audit log chain:
   *  1. hash linkage — every `previousChecksum` matches the prior
   *     entry's `checksum`;
   *  2. per-entry tamper evidence — each stored `checksum` still equals
   *     the recomputed hash of the entry's immutable fields, so mutating
   *     a row (even while keeping links intact) is detected.
   */
  async verifyChainIntegrity(): Promise<{
    valid: boolean;
    brokenLinks: AuditLog[];
    tamperedEntries: AuditLog[];
  }> {
    const logs = await this.auditLogRepo.find({ order: { createdAt: 'ASC' } });
    const brokenLinks: AuditLog[] = [];
    const tamperedEntries: AuditLog[] = [];

    for (let i = 0; i < logs.length; i++) {
      if (
        i > 0 &&
        logs[i].previousChecksum !== null &&
        logs[i].previousChecksum !== logs[i - 1].checksum
      ) {
        brokenLinks.push(logs[i]);
        this.logger.warn(`Chain broken at log ID: ${logs[i].id}`);
      }

      const recomputed = this.computeChecksum(
        {
          userId: logs[i].userId,
          eventType: logs[i].eventType,
          entityType: logs[i].entityType,
          entityId: logs[i].entityId,
          beforeState: logs[i].beforeState,
          afterState: logs[i].afterState,
        },
        new Date(logs[i].createdAt).toISOString(),
        logs[i].previousChecksum ?? '',
      );
      if (recomputed !== logs[i].checksum) {
        tamperedEntries.push(logs[i]);
        this.logger.warn(`Tampered entry detected at log ID: ${logs[i].id}`);
      }
    }

    return {
      valid: brokenLinks.length === 0 && tamperedEntries.length === 0,
      brokenLinks,
      tamperedEntries,
    };
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

  // ─── Export (issue #423) ────────────────────────────────────────────

  async findInRange(from: Date, to: Date): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { createdAt: Between(from, to) },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Export audit log to CSV format
   */
  async exportAuditLog(dateRange: { from: Date; to: Date }): Promise<string> {
    const logs = await this.findInRange(dateRange.from, dateRange.to);

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
      csvRows.push(row.map((field) => `"${field}"`).join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Export audit log as structured JSON for compliance tooling.
   */
  async exportAuditLogJson(dateRange: {
    from: Date;
    to: Date;
  }): Promise<{
    count: number;
    range: { from: Date; to: Date };
    entries: AuditLog[];
  }> {
    const logs = await this.findInRange(dateRange.from, dateRange.to);
    return {
      count: logs.length,
      range: { from: dateRange.from, to: dateRange.to },
      entries: logs.map((log) => ({
        ...log,
        checksumValid:
          this.computeChecksum(
            {
              userId: log.userId,
              eventType: log.eventType,
              entityType: log.entityType,
              entityId: log.entityId,
              beforeState: log.beforeState,
              afterState: log.afterState,
            },
            new Date(log.createdAt).toISOString(),
            log.previousChecksum ?? '',
          ) === log.checksum,
      })),
    };
  }

  // ─── Signed download links ─────────────────────────────────────────

  private exportSecret(): string {
    return (
      process.env.AUDIT_EXPORT_SECRET || 'swaptrade-audit-export-dev-secret'
    );
  }

  private signPayload(payload: string): string {
    return createHmac('sha256', this.exportSecret())
      .update(payload)
      .digest('base64url');
  }

  /**
   * Issues a time-limited HMAC-signed link for downloading an export.
   * The token embeds range + format + expiry and is verified on download,
   * so no session state is required to redeem it.
   */
  async createSignedExportLink(
    dateRange: { from: Date; to: Date },
    format: ExportFormat,
    ttlSeconds = 300,
  ): Promise<SignedExportLink> {
    if (!(dateRange.from <= dateRange.to)) {
      throw new Error('Invalid export range: "from" must be before "to"');
    }
    const payload: ExportTokenPayload = {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      format,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signPayload(encoded);
    await this.log({
      eventType: AuditEventType.AUDIT_EXPORTED,
      severity: AuditSeverity.WARNING,
      metadata: {
        from: payload.from,
        to: payload.to,
        format,
        expiresAt: payload.exp,
      },
    });
    return {
      url: `/admin/audit/export/download?token=${encoded}.${signature}`,
      expiresAt: new Date(payload.exp * 1000),
      format,
    };
  }

  /**
   * Validates a signed export token and produces the download document.
   * Returns null when the signature, format or expiry fails validation.
   */
  async downloadSignedExport(
    token: string,
  ): Promise<{
    filename: string;
    contentType: string;
    content: string;
  } | null> {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const encoded = token.slice(0, dot);
    const signature = token.slice(dot + 1);

    const expected = Buffer.from(this.signPayload(encoded));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }

    let payload: ExportTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (payload.format !== 'csv' && payload.format !== 'json') return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;

    const range = { from: new Date(payload.from), to: new Date(payload.to) };
    if (
      Number.isNaN(range.from.getTime()) ||
      Number.isNaN(range.to.getTime())
    ) {
      return null;
    }

    if (payload.format === 'csv') {
      return {
        filename: `audit-log-${payload.from}-${payload.to}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: await this.exportAuditLog(range),
      };
    }
    const json = await this.exportAuditLogJson(range);
    return {
      filename: `audit-log-${payload.from}-${payload.to}.json`,
      contentType: 'application/json; charset=utf-8',
      content: JSON.stringify(json, null, 2),
    };
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }
}
