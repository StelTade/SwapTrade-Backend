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
import { InstitutionalClient } from './institutional-client.entity';

/**
 * SLA (Service-Level Agreement) policy for institutional clients.
 * Defines response-time targets, uptime guarantees, and alert thresholds.
 */
@Entity('sla_policies')
@Index(['institutionalClientId', 'metricType'])
export class SlaPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  institutionalClientId: string;

  @ManyToOne(() => InstitutionalClient, (client) => client.slaPolicies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institutionalClientId' })
  institutionalClient: InstitutionalClient;

  /** The SLA metric being tracked */
  @Column({ type: 'varchar' })
  metricType:
    | 'API_RESPONSE_TIME'
    | 'TRADE_EXECUTION_TIME'
    | 'SYSTEM_UPTIME'
    | 'SUPPORT_RESPONSE_TIME'
    | 'REPORTING_LATENCY';

  /** Target value (e.g. 99.9 for uptime %, 200 for ms) */
  @Column('decimal', { precision: 12, scale: 4 })
  targetValue: number;

  /** Unit of measurement */
  @Column({ type: 'varchar' })
  unit: 'PERCENT' | 'MILLISECONDS' | 'SECONDS' | 'MINUTES';

  /** Threshold at which to trigger a warning alert */
  @Column('decimal', { precision: 12, scale: 4, nullable: true })
  warningThreshold?: number;

  /** Threshold at which to trigger a critical alert */
  @Column('decimal', { precision: 12, scale: 4, nullable: true })
  criticalThreshold?: number;

  /** Whether this SLA policy is active */
  @Column({ default: true })
  isActive: boolean;

  /** Current measured value (updated by monitoring service) */
  @Column('decimal', { precision: 12, scale: 4, nullable: true })
  currentValue?: number;

  /** Last time this SLA was evaluated */
  @Column({ type: 'timestamp', nullable: true })
  lastEvaluatedAt?: Date;

  /** Whether the SLA is currently in violation */
  @Column({ default: false })
  isViolated: boolean;

  /** Timestamp of last SLA violation */
  @Column({ type: 'timestamp', nullable: true })
  lastViolatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
