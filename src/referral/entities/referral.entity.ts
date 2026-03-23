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
import { User } from '../../user/entities/user.entity';

export enum ReferralStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REWARDED = 'REWARDED',
  EXPIRED = 'EXPIRED',
}

@Entity('referral')
@Index(['referrerId'])
@Index(['refereeId'])
@Index(['status'])
@Unique(['refereeId'])
export class Referral {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  referrerId: number;

  @Index()
  @Column({ unique: true })
  refereeId: number;

  @Column({ type: 'varchar', length: 50 })
  referralCode: string;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  rewardedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referrerId' })
  referrer: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'refereeId' })
  referee: User;
}
