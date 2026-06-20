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
import { OrderSide, OrderType, OrderStatus } from '../../common/enums/order-type.enum';

/**
 * Order entity — supports market, limit, stop-loss, take-profit,
 * and trailing-stop order types.
 *
 * - LIMIT orders rest in the order book until matched (price/amount).
 * - STOP_LOSS / TAKE_PROFIT orders are dormant until the market price
 *   crosses `stopPrice`, at which point they convert into a market order.
 * - TRAILING_STOP orders track `trailingReferencePrice` (best price seen
 *   since placement) and trigger once price retraces by `trailingDelta`.
 */
@Entity('orders')
@Index(['assetId', 'side', 'status', 'price']) // order book lookups
@Index(['status', 'type']) // stop-monitor sweep
@Index(['userId', 'status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: number;

  @Column()
  @Index()
  assetId: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  @Column({ type: 'varchar' })
  side: OrderSide;

  @Column({ type: 'varchar' })
  type: OrderType;

  @Column({ type: 'varchar', default: OrderStatus.PENDING })
  status: OrderStatus;

  /** Total order amount requested. */
  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  /** Cumulative filled amount (partial fills supported). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  filledAmount: number;

  /** Volume-weighted average price across all fills. */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  averageFillPrice: number | null;

  /** Limit price. Required for LIMIT orders; null for MARKET. */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  price: number | null;

  /** Trigger price for STOP_LOSS / TAKE_PROFIT orders. */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  stopPrice: number | null;

  /**
   * Trailing distance for TRAILING_STOP orders, expressed as a percentage
   * (e.g. 5 = 5%). Distance, not an absolute price, so it survives price
   * movement.
   */
  @Column('decimal', { precision: 8, scale: 4, nullable: true })
  trailingDelta: number | null;

  /**
   * Best price observed since the trailing-stop order was placed
   * (highest for SELL trailing stops, lowest for BUY trailing stops).
   * Recomputed on every price tick by the monitor service; the effective
   * stop price is derived from this + trailingDelta.
   */
  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  trailingReferencePrice: number | null;

  @Column({ nullable: true, type: 'timestamp' })
  triggeredAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  filledAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  cancelledAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get remainingAmount(): number {
    return Number(this.amount) - Number(this.filledAmount);
  }
}
