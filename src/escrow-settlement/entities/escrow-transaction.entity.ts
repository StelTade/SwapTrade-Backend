import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import {
  EscrowTransactionType,
} from '../enums/escrow.enums';

/**
 * EscrowTransaction — immutable audit record for every movement of funds
 * into or out of an escrow account. These are append-only and never updated;
 * they form the complete audit trail for escrow operations.
 *
 * Every deposit, release, refund, partial movement, and admin adjustment
 * creates a row here with the before/after balances for forensic review.
 */
@Entity('escrow_transactions')
@Index(['escrowAccountId'])
@Index(['swapId'])
@Index(['type'])
@Index(['createdAt'])
export class EscrowTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowAccountId: string;



  @Column({ type: 'varchar' })
  @Index()
  swapId: string;

  /** The type of escrow movement. */
  @Column({ type: 'varchar' })
  type: EscrowTransactionType;

  /** Amount moved in this transaction. */
  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  /** Remaining escrow balance AFTER this transaction. */
  @Column('decimal', { precision: 18, scale: 8 })
  balanceAfter: number;

  /** User who triggered this transaction (the depositor or admin). */
  @Column({ nullable: true })
  initiatedBy: number | null;

  /** Reason code (matches RefundReason or a free-text admin note). */
  @Column({ type: 'varchar', nullable: true })
  reasonCode: string | null;

  /** Free-text description for admin actions. */
  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  /** Linked settlement id if this transaction was part of a settlement. */
  @Column({ nullable: true })
  settlementId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
