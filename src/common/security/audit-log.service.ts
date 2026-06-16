import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { AuditLog, AuditEventType } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(userId: string, eventType: AuditEventType, metadata: unknown | null, ipAddress: string | null) {
    const record = this.auditRepo.create({
      userId,
      eventType,
      metadata,
      ipAddress,
    } as DeepPartial<AuditLog>);
    await this.auditRepo.save(record);
  }
}