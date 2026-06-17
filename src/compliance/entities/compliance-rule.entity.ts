import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum RuleType {
  TRANSACTION_LIMIT = 'transaction_limit',
  GEOGRAPHIC_RESTRICTION = 'geographic_restriction',
  ASSET_RESTRICTION = 'asset_restriction',
  VOLUME_LIMIT = 'volume_limit',
  FREQUENCY_LIMIT = 'frequency_limit',
  AML_SCREENING = 'aml_screening',
  KYC_VERIFICATION = 'kyc_verification',
  SANCTIONS_CHECK = 'sanctions_check',
}

export enum RuleSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum ActionType {
  BLOCK = 'block',
  FLAG = 'flag',
  REQUIRE_APPROVAL = 'require_approval',
  NOTIFY = 'notify',
  LOG_ONLY = 'log_only',
}

@Entity('compliance_rules')
export class ComplianceRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_name' })
  ruleName: string;

  @Column({ name: 'rule_code' })
  @Column({ unique: true })
  ruleCode: string;

  @Column({
    type: 'enum',
    enum: RuleType,
  })
  ruleType: RuleType;

  @Column({
    type: 'enum',
    enum: RuleSeverity,
  })
  severity: RuleSeverity;

  @Column({
    type: 'enum',
    enum: RuleStatus,
    default: RuleStatus.ACTIVE,
  })
  status: RuleStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json' })
  conditions: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  action: ActionType;

  @Column({ type: 'json', nullable: true })
  actionParameters: Record<string, any>;

  @Column({ name: 'is_system_rule', default: false })
  isSystemRule: boolean;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updated_by' })
  updater: User;

  @Column({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'regulatory_framework', nullable: true })
  regulatoryFramework: string;

  @Column({ name: 'compliance_category', nullable: true })
  complianceCategory: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'effective_date', nullable: true })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', nullable: true })
  expiryDate: Date;
}
