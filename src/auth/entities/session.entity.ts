import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Auth } from './auth.entity';

@Entity('sessions')
@Index(['authId', 'revoked'])
@Index(['sessionToken'], { unique: true })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authId: string;

  @ManyToOne(() => Auth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authId' })
  auth: Auth;

  @Column({ unique: true })
  sessionToken: string;

  @Column({ nullable: true })
  deviceInfo?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ default: false })
  revoked: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastActive: Date;
}
