// src/notification/entities/notification.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

@Entity('notifications')
@Index(['userId', 'read'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column()
  type: string;

  @Column({ nullable: true })
  title: string;

  @Column('text')
  message: string;

  @Column({ type: 'varchar', default: 'UNREAD' })
  status: NotificationStatus;

  @Column({ default: false })
  read: boolean;

  @Column({ type: 'timestamp', nullable: true })

  readAt: Date;

  @Column('simple-json', { nullable: true })
  data: Record<string, any>;

  @Column({ nullable: true })
  priority: string;

  @Column({ nullable: true })
  actionUrl: string;

  @Column({ default: false })
  sent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  expiresAt: Date;


  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}