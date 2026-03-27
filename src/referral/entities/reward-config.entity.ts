import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RewardType {
  BALANCE_CREDIT = 'BALANCE_CREDIT',
  XP = 'XP',
  BADGE = 'BADGE',
  TRADING_FEE_DISCOUNT = 'TRADING_FEE_DISCOUNT',
}

@Entity('reward_config')
@Index(['isActive'])
@Index(['rewardType'])
@Index(['recipientType'])
export class RewardConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column({
    type: 'enum',
    enum: ['REFERRER', 'REFEREE'],
  })
  recipientType: 'REFERRER' | 'REFEREE';

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
