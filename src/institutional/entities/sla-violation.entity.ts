import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SlaPolicy } from './sla-policy.entity';

/**
 * Records an SLA violation event.
 * Created whenever an SLA metric breaches its critical threshold.
 */
@Entity('sla_violations')
@Index(['slaPolicyId', 'resolvedAt'])
@Index(['institutionalClientId', 'createdAt'])
export class SlaViolation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  slaPolicyId: string;

  @ManyToOne(() => SlaPolicy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'slaPolicyId' })
  slaPolicy: SlaPolicy;

  @Column({ type: 'uuid' })
  institutionalClientId: string;

  /** Measured value at the time of violation */
  @Column('decimal', { precision: 12, scale: 4 })
  measuredValue: number;

  /** Target value that was breached */
  @Column('decimal', { precision: 12, scale: 4 })
  targetValue: number;

  /** Duration of the violation in seconds */
  @Column({ type: 'int', default: 0 })
  durationSeconds: number;

  /** Severity of the violation */
  @Column({ type: 'varchar', default: 'WARNING' })
  severity: 'WARNING' | 'CRITICAL';

  /** Whether the violation has been resolved */
  @Column({ default: false })
  isResolved: boolean;

  /** When the violation was resolved */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  /** Who resolved the violation */
  @Column({ nullable: true })
  resolvedBy?: string;

  /** Notes about the violation */
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;
}
