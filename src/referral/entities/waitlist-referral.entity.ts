/**
 * Waitlist Referral Entity - 等待列表推荐实体
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';

export enum ReferralStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REWARDED = 'rewarded',
  INVALID = 'invalid',
}

@Entity('waitlist_referrals')
@Unique(['referrerId', 'refereeId'])
export class WaitlistReferral {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  referrerId: number;

  @Column({ type: 'int' })
  @Index()
  refereeId: number;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  @Index()
  status: ReferralStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referralCode: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  refereeIP: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rewardedAt: Date;
}
