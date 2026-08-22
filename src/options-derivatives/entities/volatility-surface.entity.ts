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

@Entity('volatility_surfaces')
@Index(['assetId', 'expirationDate'], { unique: true })
export class VolatilitySurface {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  assetId: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'assetId' })
  asset: VirtualAsset;

  /** Target expiration date for this surface entry. */
  @Column({ type: 'datetime' })
  expirationDate: Date;

  /** Strike price for this surface point. */
  @Column('decimal', { precision: 18, scale: 8 })
  strikePrice: number;

  /** Implied volatility at this strike/expiration. */
  @Column('decimal', { precision: 10, scale: 8 })
  impliedVolatility: number;

  /** Bid implied volatility. */
  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  bidIv: number;

  /** Ask implied volatility. */
  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  askIv: number;

  /** Last traded implied volatility. */
  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  lastTradedIv: number;

  /** Number of data points contributing to this IV value. */
  @Column({ default: 0 })
  sampleCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
