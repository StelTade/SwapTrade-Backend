import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventType {
  BALANCE_CREDIT = 'BALANCE_CREDIT',
  BALANCE_DEBIT = 'BALANCE_DEBIT',
  TRADE_OPENED = 'TRADE_OPENED',
  TRADE_CLOSED = 'TRADE_CLOSED',
  TRADE_CANCELLED = 'TRADE_CANCELLED',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  LOGIN = 'LOGIN',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  // Referral system events
  REFERRAL_CONFIG_UPDATED = 'REFERRAL_CONFIG_UPDATED',
  REFERRAL_REWARD_ADJUSTED = 'REFERRAL_REWARD_ADJUSTED',
  REFERRAL_BULK_ADJUSTED = 'REFERRAL_BULK_ADJUSTED',
  REFERRAL_STATUS_CHANGED = 'REFERRAL_STATUS_CHANGED',
  REFERRAL_FLAGGED = 'REFERRAL_FLAGGED',
  REFERRAL_DISPUTE_RESOLVED = 'REFERRAL_DISPUTE_RESOLVED',
  // RBAC — roles
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  // RBAC — permissions
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  // Administrative actions
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  ADMIN_ACTION = 'ADMIN_ACTION',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['checksum'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'enum', enum: AuditEventType, name: 'event_type' })
  eventType: AuditEventType;

  @Column({ type: 'enum', enum: AuditSeverity, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  @Column({ name: 'entity_type', nullable: true })
  entityType: string; // 'trade', 'balance', 'user', etc.

  @Column({ name: 'entity_id', nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', name: 'before_state', nullable: true })
  beforeState: Record<string, any>;

  @Column({ type: 'jsonb', name: 'after_state', nullable: true })
  afterState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ name: 'request_id', nullable: true })
  requestId: string;

  // SHA-256 hash of (id + userId + eventType + beforeState + afterState + timestamp)
  @Column({ unique: true })
  checksum: string;

  // Hash of the previous log entry — creates a chain
  @Column({ name: 'previous_checksum', nullable: true })
  previousChecksum: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
