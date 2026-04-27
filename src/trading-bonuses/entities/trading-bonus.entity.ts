import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BonusStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

/**
 * Trading volume tiers and their corresponding bonus percentages.
 * < $1 000        → 0 %
 * $1 000–$9 999   → 1 %
 * $10 000–$99 999 → 2 %
 * ≥ $100 000      → 3 %
 */
export const BONUS_TIERS = [
  { minVolume: 100_000, rate: 0.03 },
  { minVolume: 10_000, rate: 0.02 },
  { minVolume: 1_000, rate: 0.01 },
  { minVolume: 0, rate: 0 },
] as const;

@Entity('trading_bonuses')
@Index(['userId', 'month'], { unique: true })
@Index(['status'])
@Index(['month'])
export class TradingBonus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  /** Format: YYYY-MM */
  @Column({ length: 7 })
  month: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'trading_volume', default: '0' })
  tradingVolume: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, name: 'bonus_amount', default: '0' })
  bonusAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, name: 'bonus_rate', default: '0' })
  bonusRate: number;

  @Column({
    type: 'enum',
    enum: BonusStatus,
    default: BonusStatus.PENDING,
  })
  status: BonusStatus;

  @Column({ name: 'calculated_at', nullable: true })
  calculatedAt: Date;

  @Column({ name: 'paid_at', nullable: true })
  paidAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
