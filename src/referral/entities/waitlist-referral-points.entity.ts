/**
 * Waitlist Referral Points Entity - 推荐积分实体
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum PointsReason {
  REFERRAL_SIGNUP = 'referral_signup',
  REFERRAL_VERIFIED = 'referral_verified',
  REFERRAL_ACTIVE = 'referral_active',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  BONUS = 'bonus',
}

@Entity('waitlist_referral_points')
export class WaitlistReferralPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  userId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  points: number;

  @Column({
    type: 'enum',
    enum: PointsReason,
  })
  reason: PointsReason;

  @Column({ type: 'int', nullable: true })
  referralId: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', nullable: true })
  createdBy: number; // 管理员 ID（如果是手动调整）

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transactionRef: string;
}
