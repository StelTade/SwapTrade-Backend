import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WaitlistUser } from '../../waitlist/entities/waitlist-user.entity';

export enum ReferralStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REWARDED = 'rewarded',
  INVALID = 'invalid',
}

@Entity('waitlist_referrals')
@Index(['referrerId'])
@Index(['refereeId'])
@Index(['referralCode'])
export class WaitlistReferral {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  referrerId: number;

  @ManyToOne(() => WaitlistUser)
  @JoinColumn({ name: 'referrerId' })
  referrer: WaitlistUser;

  @Column({ type: 'int' })
  refereeId: number;

  @ManyToOne(() => WaitlistUser)
  @JoinColumn({ name: 'refereeId' })
  referee: WaitlistUser;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ type: 'varchar', length: 20 })
  referralCode: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  refereeIP: string | null;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  rewardedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
