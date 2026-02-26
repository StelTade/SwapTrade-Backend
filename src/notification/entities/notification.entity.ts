import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

export enum NotificationChannel {
  Email = 'EMAIL',
  Sms = 'SMS',
  InApp = 'IN_APP',
  Push = 'PUSH',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  type: string;

  @Column({ type: 'simple-array' })
  channels: NotificationChannel[];

  @Column({ nullable: true })
  subject: string | null;

  @Column()
  message: string;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.SENT })
  status: NotificationStatus;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ nullable: true })
  templateKey: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
