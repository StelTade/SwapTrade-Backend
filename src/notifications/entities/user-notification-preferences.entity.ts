import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

interface ChannelPreference {
  enabled: boolean;
}

type EventPreferences = {
  [key in NotificationEventType]?: {
    [NotificationChannel.EMAIL]?: ChannelPreference;
    [NotificationChannel.SMS]?: ChannelPreference;
    [NotificationChannel.PUSH]?: ChannelPreference;
  };
}

@Entity('user_notification_preferences')
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ default: 'en' })
  preferredLanguage: string;

  @Column('jsonb')
  preferences: EventPreferences;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column('jsonb', { default: [] })
  pushDeviceTokens: string[];

  @Column({ default: true })
  allNotificationsEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}