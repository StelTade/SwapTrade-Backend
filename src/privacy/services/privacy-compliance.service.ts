import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  PrivacyAuditLog,
  ComplianceFlag,
  AuditAction,
} from '../entities/privacy-audit-log.entity';
import {
  CreatePrivacyAuditLogDto,
  PrivacyAuditLogResponseDto,
  AuditAccessLogDto,
} from '../dto/privacy-audit-log.dto';
import { PrivacyEncryptionService } from './privacy-encryption.service';

@Injectable()
export class PrivacyComplianceService {
  private readonly accessLogMaxSize = 100; // Max access logs to keep

  constructor(
    @InjectRepository(PrivacyAuditLog)
    private readonly auditLogRepository: Repository<PrivacyAuditLog>,
    private readonly encryptionService: PrivacyEncryptionService,
  ) {}

  /**
   * Create an audit log entry
   * @param createDto Audit log creation DTO
   * @returns Created audit log
   */
  async createAuditLog(
    createDto: CreatePrivacyAuditLogDto,
  ): Promise<PrivacyAuditLog> {
    const auditLog = new PrivacyAuditLog();
    auditLog.id = uuidv4();
    auditLog.pseudonymousIdHash = createDto.pseudonymousIdHash;
    auditLog.action = createDto.action;
    auditLog.encryptedDetails = createDto.encryptedDetails;
    auditLog.complianceFlags = createDto.complianceFlags || [];
    auditLog.riskAssessment = createDto.riskAssessment;
    auditLog.accessCount = 0;
    auditLog.accessLog = [];

    return await this.auditLogRepository.save(auditLog);
  }

  /**
   * Get an audit log entry by ID
   * @param auditId Audit log ID
   * @returns Audit log
   */
  async getAuditLogById(auditId: string): Promise<PrivacyAuditLog | null> {
    return await this.auditLogRepository.findOne({
      where: { id: auditId },
    });
  }

  /**
   * Get audit logs for a pseudonymous user
   * @param pseudonymousIdHash Hashed pseudonymous ID
   * @param action Optional filter by action
   * @returns Array of audit logs
   */
  async getAuditLogsByUser(
    pseudonymousIdHash: string,
    action?: AuditAction,
  ): Promise<PrivacyAuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.pseudonymousIdHash = :pseudonymousIdHash', {
        pseudonymousIdHash,
      });

    if (action) {
      query.andWhere('audit.action = :action', { action });
    }

    return await query.orderBy('audit.createdAt', 'DESC').getMany();
  }

  /**
   * Get audit logs by action type
   * @param action Action type
   * @returns Array of audit logs
   */
  async getAuditLogsByAction(action: AuditAction): Promise<PrivacyAuditLog[]> {
    return await this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Detect compliance flags in transaction
   * @param transactionData Transaction details
   * @returns Array of compliance flags
   */
  detectComplianceFlags(transactionData: {
    volume?: number;
    previousOrders?: number;
    timeSinceLastOrder?: number; // in milliseconds
    pattern?: string;
    amount?: number;
    maxNormalAmount?: number;
  }): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];

    // Check for suspicious volume
    if (transactionData.volume && transactionData.maxNormalAmount) {
      if (transactionData.volume > transactionData.maxNormalAmount * 10) {
        flags.push(ComplianceFlag.SUSPICIOUS_VOLUME);
      }
    }

    // Check for rapid orders
    if (
      transactionData.timeSinceLastOrder !== undefined &&
      transactionData.timeSinceLastOrder < 1000
    ) {
      // Less than 1 second between orders
      flags.push(ComplianceFlag.RAPID_ORDERS);
    }

    // Check for high frequency
    if (
      transactionData.previousOrders &&
      transactionData.previousOrders > 100
    ) {
      flags.push(ComplianceFlag.HIGH_FREQUENCY);
    }

    // Check for pattern matching
    if (
      transactionData.pattern &&
      this.isKnownSuspiciousPattern(transactionData.pattern)
    ) {
      flags.push(ComplianceFlag.PATTERN_MATCH);
    }

    // Check for suspicious timing
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 4) {
      // 2-4 AM trading might be suspicious
      flags.push(ComplianceFlag.SUSPICIOUS_TIMING);
    }

    return flags;
  }

  /**
   * Calculate risk score
   * @param complianceFlags Compliance flags detected
   * @param riskFactors Additional risk factors
   * @returns Risk score (0-100)
   */
  calculateRiskScore(
    complianceFlags: ComplianceFlag[],
    riskFactors?: {
      isNewAccount?: boolean;
      verificationStatus?: string;
      previousViolations?: number;
    },
  ): number {
    let score = 0;

    // Each flag adds points
    const flagWeights: { [key in ComplianceFlag]: number } = {
      [ComplianceFlag.SUSPICIOUS_VOLUME]: 20,
      [ComplianceFlag.PATTERN_MATCH]: 25,
      [ComplianceFlag.RAPID_ORDERS]: 15,
      [ComplianceFlag.SUSPICIOUS_TIMING]: 10,
      [ComplianceFlag.GEOGRAPHIC_ANOMALY]: 20,
      [ComplianceFlag.HIGH_FREQUENCY]: 18,
      [ComplianceFlag.STRUCTURING]: 30,
      [ComplianceFlag.SANCTION_HIT]: 100,
    };

    for (const flag of complianceFlags) {
      score += flagWeights[flag] || 0;
    }

    // Additional risk factors
    if (riskFactors?.isNewAccount) {
      score += 15;
    }

    if (riskFactors?.previousViolations && riskFactors.previousViolations > 0) {
      score += riskFactors.previousViolations * 10;
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Get risk level from score
   * @param score Risk score
   * @returns Risk level
   */
  getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Log access to an audit record
   * @param auditId Audit log ID
   * @param accessLog Access details
   * @returns Updated audit log
   */
  async logAuditAccess(
    auditId: string,
    accessLog: AuditAccessLogDto,
  ): Promise<PrivacyAuditLog> {
    const auditEntry = await this.getAuditLogById(auditId);

    if (!auditEntry) {
      throw new NotFoundException(`Audit log not found: ${auditId}`);
    }

    // Add to access log (keep only last maxAccessLogSize entries)
    const logs = auditEntry.accessLog || [];
    logs.push(accessLog);

    if (logs.length > this.accessLogMaxSize) {
      logs.shift();
    }

    auditEntry.accessLog = logs;
    auditEntry.accessCount++;

    return await this.auditLogRepository.save(auditEntry);
  }

  /**
   * Get audit logs within date range
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of audit logs
   */
  async getAuditLogsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PrivacyAuditLog[]> {
    return await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('audit.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Get high-risk audit logs
   * @param riskLevel Minimum risk level
   * @returns Array of audit logs
   */
  async getHighRiskLogs(
    riskLevel: 'HIGH' | 'CRITICAL',
  ): Promise<PrivacyAuditLog[]> {
    const logs = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
    });

    return logs.filter((log) => {
      if (!log.riskAssessment) return false;
      if (riskLevel === 'CRITICAL') {
        return log.riskAssessment.riskLevel === 'CRITICAL';
      }
      return (
        log.riskAssessment.riskLevel === 'CRITICAL' ||
        log.riskAssessment.riskLevel === 'HIGH'
      );
    });
  }

  /**
   * Get logs with specific compliance flag
   * @param flag Compliance flag to filter by
   * @returns Array of audit logs
   */
  async getLogsByComplianceFlag(
    flag: ComplianceFlag,
  ): Promise<PrivacyAuditLog[]> {
    const logs = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
    });

    return logs.filter(
      (log) => log.complianceFlags && log.complianceFlags.includes(flag),
    );
  }

  /**
   * Generate compliance report
   * @param startDate Start date
   * @param endDate End date
   * @returns Compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalAudits: number;
    highRiskCount: number;
    criticalRiskCount: number;
    flagDistribution: { [key in ComplianceFlag]: number };
    topFlags: Array<{ flag: ComplianceFlag; count: number }>;
  }> {
    const logs = await this.getAuditLogsByDateRange(startDate, endDate);

    const flagDistribution: { [key in ComplianceFlag]?: number } = {};
    let highRiskCount = 0;
    let criticalRiskCount = 0;

    for (const log of logs) {
      if (log.riskAssessment) {
        if (log.riskAssessment.riskLevel === 'HIGH') highRiskCount++;
        if (log.riskAssessment.riskLevel === 'CRITICAL') criticalRiskCount++;
      }

      for (const flag of log.complianceFlags || []) {
        flagDistribution[flag] = (flagDistribution[flag] || 0) + 1;
      }
    }

    const topFlags = Object.entries(flagDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([flag, count]) => ({
        flag: flag as ComplianceFlag,
        count: count,
      }));

    return {
      totalAudits: logs.length,
      highRiskCount,
      criticalRiskCount,
      flagDistribution: flagDistribution as { [key in ComplianceFlag]: number },
      topFlags,
    };
  }

  /**
   * Export audit logs for compliance review
   * @param pseudonymousIdHash Hashed user ID (optional)
   * @returns Encrypted audit export
   */
  async exportAuditLogs(pseudonymousIdHash?: string): Promise<{
    exportId: string;
    logsCount: number;
    exportedAt: Date;
  }> {
    let logs: PrivacyAuditLog[];

    if (pseudonymousIdHash) {
      logs = await this.getAuditLogsByUser(pseudonymousIdHash);
    } else {
      logs = await this.auditLogRepository.find();
    }

    const exportId = uuidv4();

    return {
      exportId,
      logsCount: logs.length,
      exportedAt: new Date(),
    };
  }

  /**
   * Check if pattern matches known suspicious patterns
   * @param pattern Pattern to check
   * @returns True if suspicious
   */
  private isKnownSuspiciousPattern(pattern: string): boolean {
    // Known suspicious patterns (structuring, layering, etc.)
    const suspiciousPatterns = [
      'structuring', // Multiple small transactions to avoid threshold
      'round-tripping', // Buying and selling same asset immediately
      'wash-trading', // Fake buy/sell to create volume
      'pump-and-dump', // Coordinated price manipulation
    ];

    return suspiciousPatterns.some((p) => pattern.toLowerCase().includes(p));
  }

  /**
   * Convert audit log to response DTO (can exclude encrypted data)
   * @param auditLog Audit log entity
   * @param includeEncrypted Whether to include encrypted details
   * @returns Response DTO
   */
  toResponseDto(
    auditLog: PrivacyAuditLog,
    includeEncrypted: boolean = false,
  ): PrivacyAuditLogResponseDto {
    return {
      id: auditLog.id,
      action: auditLog.action,
      complianceFlags: auditLog.complianceFlags,
      riskAssessment: auditLog.riskAssessment,
      accessCount: auditLog.accessCount,
      createdAt: auditLog.createdAt,
    };
  }

  /**
   * Count total audit logs
   * @returns Total count
   */
  async countTotalAuditLogs(): Promise<number> {
    return await this.auditLogRepository.count();
  }

  /**
   * Delete old audit logs (for cleanup)
   * @param olderThanDays Delete logs older than this many days
   * @returns Number of deleted logs
   */
  async deleteOldAuditLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.auditLogRepository.delete({
      createdAt: <any>{
        $lt: cutoffDate,
      },
    });

    return result.affected || 0;
  }
}
