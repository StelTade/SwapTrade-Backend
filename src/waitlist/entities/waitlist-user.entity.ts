import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { VerificationToken } from './verification-token.entity';

export enum WaitlistStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  INVITED = 'invited',
  EXCLUDED = 'excluded',
}

@Entity()
export class WaitlistUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'varchar', default: WaitlistStatus.PENDING })
  status: WaitlistStatus;

  @Column({ nullable: true })
  referralCode: string;

  @Column({ nullable: true })
  referredBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => VerificationToken, (token) => token.waitlistUser)
  verificationToken: VerificationToken;
}
