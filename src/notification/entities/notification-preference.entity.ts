import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { NotificationFrequency } from './user-notification-preferences.entity';

@Entity('notification_preferences')
@Unique(['userId'])
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ default: true })
  orderFilled: boolean;

  @Column({ default: true })
  priceAlerts: boolean;

  @Column({ default: true })
  achievementUnlocked: boolean;

  
  // Add the missing frequency field
  @Column({
    type: 'enum',
    enum: NotificationFrequency,
    default: NotificationFrequency.INSTANT,
  })
  frequency: NotificationFrequency;

  // Add the missing channels field (assuming it's an array of strings)
  @Column('simple-array', { default: 'in-app,email' })
  channels: string[];
}