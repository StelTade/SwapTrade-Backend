import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  TRANSACTION = 'transaction',
  APPROVAL = 'approval',
  REJECTION = 'rejection',
  EXPORT = 'export',
  IMPORT = 'import',
  CONFIG_CHANGE = 'config_change',
  ROLE_CHANGE = 'role_change',
}

export enum ResourceType {
  USER = 'user',
  TRANSACTION = 'transaction',
  PORTFOLIO = 'portfolio',
  COMPLIANCE_RULE = 'compliance_rule',
  COMPLIANCE_ALERT = 'compliance_alert',
  SYSTEM_CONFIG = 'system_config',
  API_KEY = 'api_key',
  REPORT = 'report',
  ASSET = 'asset',
}

export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  PENDING = 'pending',
}

@Entity('audit_trail')
export class AuditTrailEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'audit_id' })
  @Column({ unique: true })
  auditId: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'session_id', nullable: true })
  @Index()
  sessionId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: ResourceType,
  })
  @Index()
  resourceType: ResourceType;

  @Column({ name: 'resource_id' })
  @Index()
  resourceId: string;

  @Column({ name: 'resource_name', nullable: true })
  resourceName: string;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
  })
  @Index()
  status: AuditStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  oldValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'ip_address' })
  @Index()
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ name: 'endpoint', nullable: true })
  endpoint: string;

  @Column({ name: 'http_method', nullable: true })
  httpMethod: string;

  @Column({ name: 'response_code', nullable: true })
  responseCode: number;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs: number;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'is_sensitive_operation', default: false })
  isSensitiveOperation: boolean;

  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  @Column({ name: 'correlation_id', nullable: true })
  @Index()
  correlationId: string;

  @Column({ name: 'client_version', nullable: true })
  clientVersion: string;

  @Column({ name: 'device_fingerprint', nullable: true })
  deviceFingerprint: string;

  @Column({ name: 'location_data', type: 'json', nullable: true })
  locationData: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };

  @Column({ name: 'compliance_flags', type: 'json', nullable: true })
  complianceFlags: string[];

  @Column({ name: 'retention_period_days', nullable: true })
  retentionPeriodDays: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;
}
