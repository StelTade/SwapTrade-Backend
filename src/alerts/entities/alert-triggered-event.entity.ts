import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationChannel } from '../../notification/entities/notification.entity';

@Entity('alert_triggered_events')
@Index(['alertId', 'triggeredAt'])
@Index(['userId', 'triggeredAt'])
export class AlertTriggeredEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  alertId: number;

  @Column()
  @Index()
  userId: number;

  @CreateDateColumn()
  triggeredAt: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  triggerValue: number;

  @Column({ nullable: true })
  notificationId: number | null;

  @Column({ type: 'varchar', nullable: true })
  channel: NotificationChannel | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
