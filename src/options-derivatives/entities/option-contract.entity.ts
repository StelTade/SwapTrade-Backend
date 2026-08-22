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
import { OptionType } from '../enums/option-type.enum';
import { OptionStatus } from '../enums/option-status.enum';
import { ExerciseStyle } from '../enums/exercise-style.enum';

@Entity('option_contracts')
@Index(['underlyingAssetId', 'expirationDate'])
@Index(['status', 'expirationDate'])
export class OptionContract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  optionType: OptionType;

  @Column({ type: 'varchar', default: ExerciseStyle.EUROPEAN })
  exerciseStyle: ExerciseStyle;

  @Column()
  @Index()
  underlyingAssetId: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'underlyingAssetId' })
  underlyingAsset: VirtualAsset;

  /** Strike price in quote asset units. */
  @Column('decimal', { precision: 18, scale: 8 })
  strikePrice: number;

  @Column({ type: 'datetime' })
  expirationDate: Date;

  /** Contract size = number of underlying units per contract. */
  @Column('decimal', { precision: 18, scale: 8, default: 1 })
  contractSize: number;

  /** Current market price of the underlying at creation. */
  @Column('decimal', { precision: 18, scale: 8 })
  underlyingPriceAtCreation: number;

  /** Option premium per unit. */
  @Column('decimal', { precision: 18, scale: 8 })
  premium: number;

  /** Implied volatility used for pricing (annualized). */
  @Column('decimal', { precision: 10, scale: 8, default: 0.3 })
  impliedVolatility: number;

  /** Risk-free interest rate used for pricing. */
  @Column('decimal', { precision: 10, scale: 8, default: 0.05 })
  riskFreeRate: number;

  /** Delta — option sensitivity to underlying price. */
  @Column('decimal', { precision: 10, scale: 8, default: 0 })
  delta: number;

  /** Gamma — rate of change of delta. */
  @Column('decimal', { precision: 10, scale: 8, default: 0 })
  gamma: number;

  /** Vega — sensitivity to volatility changes. */
  @Column('decimal', { precision: 10, scale: 8, default: 0 })
  vega: number;

  /** Theta — time decay. */
  @Column('decimal', { precision: 10, scale: 8, default: 0 })
  theta: number;

  /** Rho — sensitivity to interest rate changes. */
  @Column('decimal', { precision: 10, scale: 8, default: 0 })
  rho: number;

  /** Total contracts available (initial supply). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalSupply: number;

  /** Contracts still outstanding (unsold + unexercised). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  openInterest: number;

  /** Whether option was in-the-money at last check. */
  @Column({ default: false })
  inTheMoney: boolean;

  @Column({ type: 'varchar', default: OptionStatus.ACTIVE })
  status: OptionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
