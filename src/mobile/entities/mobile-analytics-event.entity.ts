import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DevicePlatform } from './mobile-device.entity';

@Entity('mobile_analytics_events')
@Index(['userId', 'eventName'])
@Index(['createdAt'])
export class MobileAnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  eventName: string;

  @Column({ type: 'varchar', nullable: true })
  platform?: DevicePlatform;

  @Column({ nullable: true })
  appVersion?: string;

  @Column({ nullable: true })
  screenName?: string;

  @Column({ type: 'jsonb', nullable: true })
  properties?: Record<string, unknown>;

  @Column({ nullable: true })
  sessionId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
