import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import * as crypto from 'crypto';

export interface AuditLogParams {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  ip?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Log an action to the immutable audit trail
   */
  async log(params: AuditLogParams): Promise<AuditLog> {
    try {
      // Get the last log to establish hash chain
      const lastLog = await this.auditRepo.findOne({
        order: { timestamp: 'DESC' },
      });

      const previousHash = lastLog ? lastLog.hash : 'GENESIS_HASH';
      const timestamp = new Date();
      
      // Create data payload for hashing
      const dataToHash = JSON.stringify({
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldValue: params.oldValue,
        newValue: params.newValue,
        status: params.status,
        timestamp: timestamp.toISOString(),
        previousHash,
      });

      // Calculate SHA-256 hash
      const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      const log = this.auditRepo.create({
        ...params,
        timestamp,
        previousHash,
        hash,
        status: params.status || 'SUCCESS',
      });

      return await this.auditRepo.save(log);
    } catch (error) {
      this.logger.error('Failed to write audit log', error.stack);
      // In a real system, we might want to halt operations if auditing fails
      throw error;
    }
  }

  /**
   * Verify the integrity of the audit log chain
   */
  async verifyIntegrity(): Promise<{ valid: boolean; brokenAtId?: string }> {
    const logs = await this.auditRepo.find({ order: { timestamp: 'ASC' } });
    
    if (logs.length === 0) return { valid: true };

    let previousHash = 'GENESIS_HASH';

    for (const log of logs) {
      if (log.previousHash !== previousHash) {
        return { valid: false, brokenAtId: log.id };
      }

      const dataToHash = JSON.stringify({
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        oldValue: log.oldValue,
        newValue: log.newValue,
        status: log.status,
        timestamp: log.timestamp.toISOString(),
        previousHash: log.previousHash,
      });

      const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      if (calculatedHash !== log.hash) {
        return { valid: false, brokenAtId: log.id };
      }

      previousHash = log.hash;
    }

    return { valid: true };
  }

  /**
   * Generate compliance report
   */
  async generateReport(type: 'SOC2' | 'GDPR' | 'AML', startDate: Date, endDate: Date): Promise<any> {
    const where: FindOptionsWhere<AuditLog> = {
      timestamp: Between(startDate, endDate),
    };

    const logs = await this.auditRepo.find({ where, order: { timestamp: 'DESC' } });

    switch (type) {
      case 'SOC2':
        return {
          reportType: 'SOC 2 Type II - System Activity',
          period: { start: startDate, end: endDate },
          totalEvents: logs.length,
          accessEvents: logs.filter(l => l.action.includes('LOGIN') || l.action.includes('ACCESS')).length,
          changeEvents: logs.filter(l => l.action.includes('UPDATE') || l.action.includes('CREATE')).length,
          failures: logs.filter(l => l.status === 'FAILURE').length,
          details: logs.map(l => ({ timestamp: l.timestamp, action: l.action, user: l.userId, status: l.status }))
        };
      
      case 'GDPR':
        return {
          reportType: 'GDPR - Data Access Log',
          period: { start: startDate, end: endDate },
          dataAccessEvents: logs.filter(l => l.resource === 'USER_DATA').length,
          consentChanges: logs.filter(l => l.action.includes('CONSENT')).length,
          details: logs.filter(l => l.resource === 'USER_DATA' || l.action.includes('CONSENT'))
        };

      case 'AML':
        return {
          reportType: 'AML - Transaction Log',
          period: { start: startDate, end: endDate },
          transactions: logs.filter(l => l.resource === 'TRADE' || l.resource === 'BALANCE').length,
          largeTransactions: logs.filter(l => l.metadata?.amount > 10000).length,
          details: logs.filter(l => l.resource === 'TRADE' || l.resource === 'BALANCE')
        };
    }
  }
}