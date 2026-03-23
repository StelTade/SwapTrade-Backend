import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Referral } from './referral.entity';
import { RewardType } from './reward-config.entity';

export enum DistributionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

@Entity('reward_distribution')
@Index(['referralId'])
@Index(['userId'])
@Index(['status'])
export class RewardDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  referralId: number;

  @Index()
  @Column()
  userId: number;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', length: 50 })
  recipientType: 'REFERRER' | 'REFEREE';

  @Column({
    type: 'enum',
    enum: DistributionStatus,
    default: DistributionStatus.PENDING,
  })
  status: DistributionStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Referral)
  @JoinColumn({ name: 'referralId' })
  referral: Referral;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
