import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationChannel } from './notification.entity';

export enum NotificationFrequency {
  INSTANT = 'INSTANT',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
}

@Entity('user_notification_preferences')
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'varchar', default: NotificationFrequency.INSTANT })
  frequency: NotificationFrequency;

  @Column({ type: 'simple-array', default: 'IN_APP,EMAIL' })
  channels: NotificationChannel[];

  @Column({ default: true })
  tradeNotifications: boolean;

  @Column({ default: true })
  balanceNotifications: boolean;

  @Column({ default: true })
  milestoneNotifications: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
