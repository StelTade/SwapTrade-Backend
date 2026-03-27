import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum DistributionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('reward_distribution')
@Index(['referralId'])
@Index(['userId'])
@Index(['status'])
export class RewardDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  referralId: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  rewardType: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['REFERRER', 'REFEREE'],
  })
  recipientType: 'REFERRER' | 'REFEREE';

  @Column({
    type: 'enum',
    enum: DistributionStatus,
    default: DistributionStatus.PENDING,
  })
  status: DistributionStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
