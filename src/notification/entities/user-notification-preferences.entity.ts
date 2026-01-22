import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum NotificationFrequency {
  INSTANT = 'instant',
  HOURLY = 'hourly',
  DAILY = 'daily'
}

export enum NotificationChannel {
  IN_APP = 'in-app',
  EMAIL = 'email'
}

@Entity('user_notification_preferences')
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationFrequency,
    default: NotificationFrequency.INSTANT
  })
  frequency: NotificationFrequency;

  @Column('simple-array', { default: 'in-app,email' })
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