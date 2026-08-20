import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';

/**
 * A user's request to move funds off-platform to an external address. Its
 * `status` tracks the full lifecycle (see {@link WithdrawalStatus}); the
 * reserved ledger amount is created once on initiation and is always either
 * released (reject/cancel/fail) or debited (complete) — never both.
 */
@Entity('withdrawal_requests')
@Index(['userId'])
@Index(['status'])
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  network: BlockchainNetwork;

  @Column({ default: 'USDC' })
  asset: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column()
  toAddress: string;

  @Column({ nullable: true })
  memo: string;

  @Column({ type: 'varchar', default: WithdrawalStatus.QUEUED })
  status: WithdrawalStatus;

  /** True when `amount` met the approval threshold at initiation time. */
  @Column({ default: false })
  requiresApproval: boolean;

  /** authId of the approving admin. */
  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true, type: 'timestamp' })
  approvedAt: Date;

  @Column({ nullable: true })
  rejectedReason: string;

  @Column({ nullable: true })
  txHash: string;

  /** FK to the BlockchainTransaction row created when broadcast. */
  @Column({ nullable: true })
  blockchainTxId: string | null;

  @Column({ default: 0 })
  confirmations: number;

  @Column({ nullable: true })
  errorMessage: string;

  /** Number of broadcast attempts (guards against re-broadcast on retry). */
  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
