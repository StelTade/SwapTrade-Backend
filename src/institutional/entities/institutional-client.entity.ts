import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SlaPolicy } from './sla-policy.entity';
import { SupportTicket } from './support-ticket.entity';

/**
 * Institutional client profile — extends the base User entity
 * with institutional-specific metadata such as account manager,
 * SLA tier, API quotas, and compliance settings.
 */
@Entity('institutional_clients')
@Index(['userId'], { unique: true })
@Index(['accountManagerId'])
@Index(['slaTier'])
export class InstitutionalClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK to the users table */
  @Column({ type: 'int', unique: true })
  userId: number;

  /** Company / fund name */
  @Column()
  companyName: string;

  /** Legal entity identifier (LEI) */
  @Column({ nullable: true })
  lei?: string;

  /** Tax identification number */
  @Column({ nullable: true })
  taxId?: string;

  /** Jurisdiction / country of incorporation */
  @Column({ nullable: true })
  jurisdiction?: string;

  /** Assigned account manager (staff user ID) */
  @Column({ type: 'int', nullable: true })
  accountManagerId?: number;

  /** SLA tier: PLATINUM | GOLD | SILVER */
  @Column({ type: 'varchar', default: 'GOLD' })
  slaTier: 'PLATINUM' | 'GOLD' | 'SILVER';

  /** Maximum trades per second for bulk API */
  @Column({ type: 'int', default: 1000 })
  maxTradesPerSecond: number;

  /** Maximum API requests per second */
  @Column({ type: 'int', default: 5000 })
  maxApiRequestsPerSecond: number;

  /** Daily trade volume limit (in quote currency) */
  @Column('decimal', { precision: 24, scale: 8, default: 0 })
  dailyVolumeLimit: number;

  /** Whether the institutional client is active */
  @Column({ default: true })
  isActive: boolean;

  /** Dedicated IP whitelist for API access */
  @Column('simple-array', { nullable: true })
  ipWhitelist?: string[];

  /** Webhook URL for trade notifications */
  @Column({ nullable: true })
  webhookUrl?: string;

  /** Custom metadata (JSON) */
  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ─── Relations ──────────────────────────────────────────────
  @OneToMany(() => SlaPolicy, (sla) => sla.institutionalClient)
  slaPolicies: SlaPolicy[];

  @OneToMany(() => SupportTicket, (ticket) => ticket.institutionalClient)
  supportTickets: SupportTicket[];
}
