import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ParameterUpdateStatus {
  QUEUED = 'QUEUED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('pending_governance_parameter_updates')
@Index(['status', 'executeAfter'])
export class PendingGovernanceParameterUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  parameterKey: string;

  @Column({ type: 'simple-json' })
  patch: Record<string, unknown>;

  @Column({ type: 'varchar', default: ParameterUpdateStatus.QUEUED })
  status: ParameterUpdateStatus;

  @Column({ type: 'int' })
  requestedBy: number;

  @Column({ type: 'int', nullable: true })
  executedBy?: number | null;

  @Column({ type: 'integer' })
  minimumDelayMs: number;

  @Column({ type: 'datetime' })
  executeAfter: Date;

  @Column({ type: 'datetime', nullable: true })
  executedAt?: Date | null;

  @Column({ type: 'simple-json' })
  beforeValue: Record<string, unknown>;

  @Column({ type: 'simple-json' })
  afterValue: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  executionResult?: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
