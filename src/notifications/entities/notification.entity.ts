import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'varchar',
    enum: NotificationEventType,
  })
  type: NotificationEventType;

  @Column({
    type: 'varchar',
    enum: NotificationChannel,
  })
  channel: NotificationChannel;

  @Column({
    type: 'varchar',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column('jsonb')
  data: Record<string, any>;

  @Column({ nullable: true })
  recipient: string; // Email for EMAIL, phone for SMS, device token for PUSH

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt: Date;

  @Column({ nullable: true })
  sentAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column({ nullable: true })
  readAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
