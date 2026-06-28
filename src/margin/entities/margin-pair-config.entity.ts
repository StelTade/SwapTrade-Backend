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

@Entity('margin_pair_configs')
@Index(['baseAssetId', 'quoteAssetId'], { unique: true })
export class MarginPairConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  baseAssetId: number;

  @Column()
  @Index()
  quoteAssetId: number;

  /** Maximum allowed leverage (e.g. 10 = 10x). */
  @Column('decimal', { precision: 8, scale: 2, default: 10 })
  maxLeverage: number;

  /** Initial margin rate as a fraction (0.1 = 10% = 10x max leverage). */
  @Column('decimal', { precision: 8, scale: 6, default: 0.1 })
  initialMarginRate: number;

  /** Maintenance margin rate as a fraction (0.05 = 5%). */
  @Column('decimal', { precision: 8, scale: 6, default: 0.05 })
  maintenanceMarginRate: number;

  /** Daily interest on borrowed funds in basis points (10 = 0.1% per day). */
  @Column({ default: 10 })
  dailyInterestRateBps: number;

  /** Annualized volatility percentage used to cap leverage. */
  @Column('decimal', { precision: 8, scale: 4, default: 50 })
  volatilityPct: number;

  /** Multiplier applied to volatility when computing leverage cap. */
  @Column('decimal', { precision: 8, scale: 4, default: 2 })
  volatilityLeverageFactor: number;

  /**
   * Margin-call alert fires when equity / maintenanceRequirement drops
   * below this ratio (e.g. 1.15 = 15% buffer above liquidation).
   */
  @Column('decimal', { precision: 8, scale: 4, default: 1.15 })
  marginCallThresholdRatio: number;

  @Column({ default: true })
  isEnabled: boolean;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'baseAssetId' })
  baseAsset: VirtualAsset;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'quoteAssetId' })
  quoteAsset: VirtualAsset;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
