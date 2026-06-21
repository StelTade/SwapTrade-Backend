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
import { LiquidityPool } from './liquidity-pool.entity';

@Entity('pool_positions')
@Index(['poolId', 'userId'], { unique: true })
export class PoolPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  poolId: number;

  @Column()
  @Index()
  userId: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  lpAmount: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  depositedAmountA: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  depositedAmountB: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  feesEarnedA: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  feesEarnedB: number;

  @Column({ nullable: true })
  depositedAt: Date;

  @ManyToOne(() => LiquidityPool)
  @JoinColumn({ name: 'poolId' })
  pool: LiquidityPool;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
