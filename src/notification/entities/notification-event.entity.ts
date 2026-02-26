import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  TRADE_EXECUTED = 'trade',
  BALANCE_UPDATED = 'balance',
  PORTFOLIO_MILESTONE = 'milestone'
}

@Entity('notification_events')
@Index(['userId', 'createdAt'])
@Index(['userId', 'read'])
export class NotificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType
  })
  type: NotificationType;

  @Column('jsonb')
  data: Record<string, any>;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}