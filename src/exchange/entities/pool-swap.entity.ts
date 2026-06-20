import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { LiquidityPool } from './liquidity-pool.entity';

@Entity('pool_swaps')
export class PoolSwap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  poolId: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  tokenIn: string;

  @Column()
  tokenOut: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amountIn: number;

  @Column('decimal', { precision: 18, scale: 8 })
  amountOut: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  feePaid: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  priceImpact: number;

  @Column({ default: 'COMPLETED' })
  status: string;

  @ManyToOne(() => LiquidityPool)
  @JoinColumn({ name: 'poolId' })
  pool: LiquidityPool;

  @CreateDateColumn()
  createdAt: Date;
}
