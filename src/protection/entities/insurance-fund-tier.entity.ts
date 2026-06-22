import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { FundTier } from '../enums/fund-tier.enum';

@Entity('insurance_fund_tiers')
export class InsuranceFundTier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  @Index()
  tier: FundTier;

  @Column()
  name: string;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  minReserve: number;

  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  maxExposure: number;

  @Column({ default: 10 })
  feeContributionPct: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
