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
 * Dedicated support ticket for institutional clients.
 * Supports priority escalation, SLA tracking, and account-manager assignment.
 */
@Entity('institutional_support_tickets')
@Index(['institutionalClientId', 'status'])
@Index(['assignedToId', 'status'])
@Index(['priority', 'status'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Auto-generated ticket number for display */
  @Column({ unique: true })
  ticketNumber: string;

  @Column({ type: 'uuid' })
  institutionalClientId: string;

  @ManyToOne(
    () => InstitutionalClient,
    (client) => client.supportTickets,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'institutionalClientId' })
  institutionalClient: InstitutionalClient;

  /** Institutional user who created the ticket */
  @Column({ type: 'int' })
  createdById: number;

  /** Subject line */
  @Column()
  subject: string;

  /** Detailed description */
  @Column({ type: 'text' })
  description: string;

  /** Ticket category */
  @Column({ type: 'varchar', default: 'GENERAL' })
  category:
    | 'GENERAL'
    | 'TRADING'
    | 'TECHNICAL'
    | 'COMPLIANCE'
    | 'BILLING'
    | 'ONBOARDING';

  /** Priority level */
  @Column({ type: 'varchar', default: 'HIGH' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /** Current status */
  @Column({ type: 'varchar', default: 'OPEN' })
  status:
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'WAITING_ON_CLIENT'
    | 'ESCALATED'
    | 'RESOLVED'
    | 'CLOSED';

  /** Assigned support staff user ID */
  @Column({ type: 'int', nullable: true })
  assignedToId?: number;

  /** Account manager user ID (auto-populated from InstitutionalClient) */
  @Column({ type: 'int', nullable: true })
  accountManagerId?: number;

  /** SLA response deadline */
  @Column({ type: 'timestamp', nullable: true })
  slaResponseDeadline?: Date;

  /** SLA resolution deadline */
  @Column({ type: 'timestamp', nullable: true })
  slaResolutionDeadline?: Date;

  /** Whether SLA response was met */
  @Column({ nullable: true })
  slaResponseMet?: boolean;

  /** Whether SLA resolution was met */
  @Column({ nullable: true })
  slaResolutionMet?: boolean;

  /** Internal notes (not visible to client) */
  @Column({ type: 'text', nullable: true })
  internalNotes?: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
