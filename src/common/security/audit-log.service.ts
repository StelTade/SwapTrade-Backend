import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(userId: string, action: string, details: unknown | null, ip: string | null) {
    const record = this.auditRepo.create({
      userId,
      action,
      details,
      ip,
    });
    await this.auditRepo.save(record);
  }
}

