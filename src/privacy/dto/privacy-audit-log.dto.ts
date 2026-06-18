import { IsOptional, IsEnum, IsObject, IsString } from 'class-validator';
import {
  ComplianceFlag,
  AuditAction,
} from '../entities/privacy-audit-log.entity';

export class CreatePrivacyAuditLogDto {
  @IsString()
  pseudonymousIdHash: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  encryptedDetails: string;

  @IsEnum(ComplianceFlag, { each: true })
  @IsOptional()
  complianceFlags?: ComplianceFlag[];

  @IsObject()
  @IsOptional()
  riskAssessment?: {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assessment: string;
  };
}

export class AuditAccessLogDto {
  accessedBy: string;
  accessedAt: Date;
  reason: string;
  approved: boolean;
  approvedBy?: string;
}

export class PrivacyAuditLogResponseDto {
  id: string;
  action: AuditAction;
  complianceFlags?: ComplianceFlag[];
  riskAssessment?: {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assessment: string;
  };
  accessCount: number;
  createdAt: Date;
}

export class RequestAuditDecryptionDto {
  @IsString()
  auditId: string;

  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  approverEmail?: string;
}
