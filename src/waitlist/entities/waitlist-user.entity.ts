import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum WaitlistStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  INVITED = 'invited',
  EXCLUDED = 'excluded',
}

export enum WaitlistType {
  PLATFORM = 'platform',
  PREMIUM_FEATURE = 'premium_feature',
  ASSET_PAIR = 'asset_pair',
  STAKING = 'staking',
}

export enum StakingTier {
  FLEXIBLE = 'flexible',
  LOCKED = 'locked',
  LIQUIDITY = 'liquidity',
}

@Entity('waitlist_users')
@Index(['email', 'type', 'targetId'], { unique: true })
@Index(['status'])
@Index(['referralCode'])
@Index(['createdAt'])
@Index(['type'])
export class WaitlistUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  email: string;

  @Column({ nullable: true, length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: WaitlistType.PLATFORM,
  })
  type: WaitlistType;

  @Column({ nullable: true, length: 255 })
  targetId: string; // Feature name or Asset pair symbol

  @Column({
    type: 'varchar',
    length: 20,
    default: WaitlistStatus.PENDING,
  })
  status: WaitlistStatus;

  @Column({ nullable: true, length: 12 })
  referralCode: string;

  @Column({ nullable: true, length: 255 })
  referralSource: string;

  @Column({ type: 'int', default: 0 })
  votes: number; // For asset pair voting

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  invitedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
