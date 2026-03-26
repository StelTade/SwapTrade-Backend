import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WaitlistUser } from './waitlist-user.entity';

@Entity('verification_tokens')
export class VerificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ type: 'uuid' })
  waitlistUserId: string;

  @ManyToOne(() => WaitlistUser)
  @JoinColumn({ name: 'waitlistUserId' })
  waitlistUser: WaitlistUser;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
