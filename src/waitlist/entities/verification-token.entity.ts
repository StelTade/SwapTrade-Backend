import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { WaitlistUser } from './waitlist-user.entity';

@Entity()
export class VerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => WaitlistUser, (user) => user.verificationToken)
  @JoinColumn()
  waitlistUser: WaitlistUser;
}
