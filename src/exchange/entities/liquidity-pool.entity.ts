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
import { PoolStatus } from '../enums/pool-status.enum';

@Entity('liquidity_pools')
@Index(['tokenAId', 'tokenBId', 'chainId'], { unique: true })
export class LiquidityPool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tokenAId: number;

  @Column()
  @Index()
  tokenBId: number;

  @Column()
  @Index()
  chainId: string;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  reserveA: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  reserveB: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalLpSupply: number;

  @Column({ default: 30 })
  feeBps: number;

  @Column({ type: 'varchar', default: PoolStatus.ACTIVE })
  status: PoolStatus;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  accumulatedFeesA: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  accumulatedFeesB: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  totalVolume: number;

  @Column({ default: 0 })
  totalSwaps: number;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'tokenAId' })
  tokenA: VirtualAsset;

  @ManyToOne(() => VirtualAsset)
  @JoinColumn({ name: 'tokenBId' })
  tokenB: VirtualAsset;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
