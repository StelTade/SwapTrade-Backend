import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

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
}