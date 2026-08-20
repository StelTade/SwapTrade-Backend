import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SettlementResult } from '../enums/escrow.enums';

/**
 * Settlement — tracks the final outcome of a swap after both sides of the
 * escrow have been processed. A single Settlement record per swapId
 * aggregates the result, which escrow accounts were involved, and any
 * dispute information.
 *
 * Settlement is created when escrow funds are first committed and updated
 * as the settlement progresses through partial fills, dispute hooks, and
 * final resolution.
 */
@Entity('settlements')
@Index(['swapId'], { unique: true })
@Index(['result'])
@Index(['createdAt'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Groups the two escrow accounts that belong to this swap. */
  @Column({ type: 'varchar' })
  @Index()
  swapId: string;

  /** Id of the escrow account on the sell side. */
  @Column({ nullable: true })
  sellerEscrowId: string | null;

  /** Id of the escrow account on the buy side. */
  @Column({ nullable: true })
  buyerEscrowId: string | null;

  /** The seller's user id. */
  @Column({ nullable: true })
  sellerUserId: number | null;

  /** The buyer's user id. */
  @Column({ nullable: true })
  buyerUserId: number | null;

  /** The asset being traded. */
  @Column({ nullable: true })
  assetId: number | null;

  /** Total amount of the asset in the original swap. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalAmount: number;

  /** Amount that has been settled so far. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  settledAmount: number;

  /** Agreed price at match time. */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  agreedPrice: number | null;

  /** Current result — updated as the settlement progresses. */
  @Column({ type: 'varchar', default: SettlementResult.FULL })
  result: SettlementResult;

  /** True once both sides have been fully settled and funds released. */
  @Column({ default: false })
  completed: boolean;

  /** If disputed, the reason code. */
  @Column({ type: 'varchar', nullable: true })
  disputeReason: string | null;

  /** Free-text description of the dispute. */
  @Column({ type: 'text', nullable: true })
  disputeDescription: string | null;

  /** Admin id who resolved the dispute (if applicable). */
  @Column({ nullable: true })
  resolvedBy: number | null;

  /** Timestamp when the dispute was resolved. */
  @Column({ nullable: true, type: 'timestamp' })
  resolvedAt: Date | null;

  /** Admin notes for manual settlements or dispute resolutions. */
  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
