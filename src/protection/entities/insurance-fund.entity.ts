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
import { InsuranceFundTier } from './insurance-fund-tier.entity';
import { FundHealthStatus } from '../enums/fund-health-status.enum';

@Entity('insurance_funds')
@Index(['tierId', 'asset'], { unique: true })
export class InsuranceFund {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  tierId: number;

  @Column()
  asset: string;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  targetReserve: number;

  @Column({ type: 'varchar', default: FundHealthStatus.HEALTHY })
  healthStatus: FundHealthStatus;

  @Column('decimal', { precision: 5, scale: 2, default: 100 })
  healthPercent: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => InsuranceFundTier)
  @JoinColumn({ name: 'tierId' })
  tier: InsuranceFundTier;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
