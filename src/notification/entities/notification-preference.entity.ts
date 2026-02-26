import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { NotificationChannel } from './notification.entity';

@Entity()
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  @Index()
  type: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  unsubscribeToken: string | null;

  @Column({ type: 'int', default: 0 })
  dailyLimit: number;

  @Column({ type: 'int', default: 0 })
  sentToday: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSentAt: Date | null;
}
