import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { EscrowStatus } from '../enums/escrow.enums';

/**
 * EscrowAccount — holds reserved assets for one side of a peer-to-peer swap.
 *
 * Each matched swap creates two EscrowAccount records (one per party) that
 * lock the respective asset amounts until settlement completes or a refund
 * is triggered. The account is the source of truth for what is escrowed;
 * UserBalance.lockedBalance tracks the corresponding reservation on the
 * user's wallet side.
 *
 * Lifecycle:
 *   ACTIVE → SETTLING → SETTLED | REFUNDED
 *   ACTIVE → DISPUTED → SETTLED | REFUNDED
 *   ACTIVE → CANCELLED
 */
@Entity('escrow_accounts')
@Index(['swapId'])
@Index(['userId', 'status'])
@Index(['status', 'createdAt'])
export class EscrowAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Unique identifier for the swap / match that this escrow belongs to.
   * Groups the two sides of a trade together.
   */
  @Column({ type: 'varchar' })
  @Index()
  swapId: string;

  /** The user whose funds are locked in this escrow. */
  @Column()
  @Index()
  userId: number;

  /** The matched order id on this side of the swap. */
  @Column({ nullable: true })
  orderId: string | null;

  /** The matched counterparty's order id. */
  @Column({ nullable: true })
  counterpartyOrderId: string | null;

  /** The counterparty's user id. */
  @Column({ nullable: true })
  counterpartyUserId: number | null;

  @Column()
  @Index()
  assetId: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  /** Amount originally deposited into escrow. */
  @Column('decimal', { precision: 18, scale: 8 })
  depositedAmount: number;

  /**
   * Amount still held in escrow after any partial releases/refunds.
   * Maintained by EscrowService on every movement.
   */
  @Column('decimal', { precision: 18, scale: 8 })
  remainingAmount: number;

  /** Settlement price agreed upon when the match was created. */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  agreedPrice: number | null;

  @Column({ type: 'varchar', default: EscrowStatus.ACTIVE })
  status: EscrowStatus;

  /** Free-text reason for the last status change (refund/dispute). */
  @Column({ type: 'varchar', nullable: true })
  reasonCode: string | null;

  /** True once the settlement service has confirmed and released funds. */
  @Column({ default: false })
  settled: boolean;

  /** Timestamp when the escrow was settled, refunded, or disputed. */
  @Column({ nullable: true, type: 'timestamp' })
  resolvedAt: Date | null;

  /** Admin id who performed manual action (if any). */
  @Column({ nullable: true })
  resolvedBy: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
