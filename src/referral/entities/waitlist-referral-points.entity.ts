import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WaitlistReferral } from './waitlist-referral.entity';
import { WaitlistUser } from '../../waitlist/entities/waitlist-user.entity';

export enum PointsReason {
  REFERRAL_SIGNUP = 'REFERRAL_SIGNUP',
  REFERRAL_VERIFICATION = 'REFERRAL_VERIFICATION',
  BONUS = 'BONUS',
}

@Entity('waitlist_referral_points')
export class WaitlistReferralPoints {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => WaitlistUser)
  @JoinColumn({ name: 'userId' })
  user: WaitlistUser;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points: number;

  @Column({
    type: 'enum',
    enum: PointsReason,
  })
  reason: PointsReason;

  @Column({ type: 'int', nullable: true })
  referralId: number | null;

  @ManyToOne(() => WaitlistReferral, { nullable: true })
  @JoinColumn({ name: 'referralId' })
  referral: WaitlistReferral | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  transactionRef: string;

  @CreateDateColumn()
  createdAt: Date;
}
