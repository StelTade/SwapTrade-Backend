import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum ReportType {
  SAR = 'sar', // Suspicious Activity Report
  CTR = 'ctr', // Currency Transaction Report
  AML = 'aml', // Anti-Money Laundering Report
  KYC = 'kyc', // Know Your Customer Report
  TRANSACTION_MONITORING = 'transaction_monitoring',
  SANCTIONS_SCREENING = 'sanctions_screening',
  RISK_ASSESSMENT = 'risk_assessment',
  COMPLIANCE_SUMMARY = 'compliance_summary',
  AUDIT_TRAIL = 'audit_trail',
  INCIDENT_REPORT = 'incident_report',
  SEC_FORM_4 = 'sec_form_4',
  FINRA_CAT = 'finra_cat',
}

export enum ReportStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
  REJECTED = 'rejected',
  APPROVED = 'approved',
  ARCHIVED = 'archived',
}

export enum RegulatoryFramework {
  FATF = 'fatf', // Financial Action Task Force
  FINCEN = 'fincen', // Financial Crimes Enforcement Network
  SEC = 'sec', // Securities and Exchange Commission
  FINRA = 'finra', // Financial Industry Regulatory Authority
  GDPR = 'gdpr', // General Data Protection Regulation
  MiFID_II = 'mifid_ii', // Markets in Financial Instruments Directive II
  AMLD = 'amld', // Anti-Money Laundering Directive
  SOX = 'sox', // Sarbanes-Oxley Act
  PCI_DSS = 'pci_dss', // Payment Card Industry Data Security Standard
  HIPAA = 'hipaa', // Health Insurance Portability and Accountability Act
}

export enum SubmissionMethod {
  API = 'api',
  FILE_UPLOAD = 'file_upload',
  MANUAL = 'manual',
  EMAIL = 'email',
  WEB_PORTAL = 'web_portal',
  ELECTRONIC_FILING = 'electronic_filing',
}

@Entity('regulatory_reports')
export class RegulatoryReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id' })
  @Column({ unique: true })
  reportId: string;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  @Index()
  reportType: ReportType;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  @Index()
  status: ReportStatus;

  @Column({
    type: 'enum',
    enum: RegulatoryFramework,
  })
  @Index()
  regulatoryFramework: RegulatoryFramework;

  @Column({ name: 'reporting_period_start' })
  @Index()
  reportingPeriodStart: Date;

  @Column({ name: 'reporting_period_end' })
  reportingPeriodEnd: Date;

  @Column({ name: 'due_date' })
  @Index()
  dueDate: Date;

  @Column({ name: 'submission_date', nullable: true })
  submissionDate: Date;

  @Column({ name: 'acknowledgment_date', nullable: true })
  acknowledgmentDate: Date;

  @Column({ name: 'reporting_entity' })
  reportingEntity: string;

  @Column({ name: 'reporting_entity_id' })
  reportingEntityId: string;

  @Column({ name: 'subject_user_id', nullable: true })
  @Index()
  subjectUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'subject_user_id' })
  subjectUser: User;

  @Column({ name: 'related_alerts', type: 'json', nullable: true })
  relatedAlerts: string[];

  @Column({ name: 'related_transactions', type: 'json', nullable: true })
  relatedTransactions: string[];

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'json' })
  reportData: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  attachments: Array<{
    id: string;
    filename: string;
    type: string;
    size: number;
    url: string;
  }>;

  @Column({ name: 'risk_level' })
  @Index()
  riskLevel: string; // LOW, MEDIUM, HIGH, CRITICAL

  @Column({
    name: 'suspicious_activity_indicators',
    type: 'json',
    nullable: true,
  })
  suspiciousActivityIndicators: string[];

  @Column({ name: 'compliance_findings', type: 'json', nullable: true })
  complianceFindings: Array<{
    category: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;

  @Column({ name: 'submission_method' })
  submissionMethod: SubmissionMethod;

  @Column({ name: 'submission_endpoint', nullable: true })
  submissionEndpoint: string;

  @Column({ name: 'submission_reference', nullable: true })
  submissionReference: string;

  @Column({ name: 'external_case_id', nullable: true })
  externalCaseId: string;

  @Column({ name: 'regulatory_comments', type: 'text', nullable: true })
  regulatoryComments: string;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'approver_id', nullable: true })
  approverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @Column({ name: 'submitted_by' })
  submittedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by' })
  submitter: User;

  @Column({ name: 'auto_generated', default: false })
  autoGenerated: boolean;

  @Column({ name: 'template_version', nullable: true })
  templateVersion: string;

  @Column({ name: 'validation_errors', type: 'json', nullable: true })
  validationErrors: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  @Column({ name: 'submission_attempts', default: 0 })
  submissionAttempts: number;

  @Column({ name: 'last_submission_attempt', nullable: true })
  lastSubmissionAttempt: Date;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'archived_at', nullable: true })
  archivedAt: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;
}
