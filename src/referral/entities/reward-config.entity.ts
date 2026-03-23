import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum RewardType {
  BALANCE_CREDIT = 'BALANCE_CREDIT',
  TRADING_FEE_DISCOUNT = 'TRADING_FEE_DISCOUNT',
  XP = 'XP',
  BADGE = 'BADGE',
}

@Entity('reward_config')
@Unique(['rewardType', 'recipientType'])
export class RewardConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: RewardType,
  })
  rewardType: RewardType;

  @Column({ type: 'varchar', length: 20 })
  recipientType: 'REFERRER' | 'REFEREE';

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
