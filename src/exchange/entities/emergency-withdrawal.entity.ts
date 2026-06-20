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
import { EmergencyWithdrawalStatus } from '../enums/emergency-withdrawal-status.enum';

@Entity('emergency_withdrawals')
export class EmergencyWithdrawal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  poolId: number;

  @Column()
  @Index()
  userId: number;

  @Column('decimal', { precision: 18, scale: 8 })
  lpAmountBurned: number;

  @Column('decimal', { precision: 18, scale: 8 })
  amountA: number;

  @Column('decimal', { precision: 18, scale: 8 })
  amountB: number;

  @Column()
  reason: string;

  @Column({ type: 'varchar', default: EmergencyWithdrawalStatus.PENDING })
  status: EmergencyWithdrawalStatus;

  @Column({ nullable: true })
  adminApprovedBy: number;

  @ManyToOne(() => LiquidityPool)
  @JoinColumn({ name: 'poolId' })
  pool: LiquidityPool;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
