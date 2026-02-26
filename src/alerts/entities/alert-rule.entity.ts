import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationChannel } from '../../notification/entities/notification.entity';

export enum AlertType {
  PRICE = 'PRICE',
  VOLUME = 'VOLUME',
  PORTFOLIO_CHANGE = 'PORTFOLIO_CHANGE',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  TRIGGERED = 'TRIGGERED',
}

export enum AlertOperator {
  GT = 'GT',
  LT = 'LT',
  GTE = 'GTE',
  LTE = 'LTE',
}

export enum PortfolioChangeType {
  PERCENTAGE = 'PERCENTAGE',
  ABSOLUTE = 'ABSOLUTE',
}

@Entity('alert_rules')
@Index(['userId', 'status'])
@Index(['asset', 'type', 'status'])
export class AlertRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar' })
  type: AlertType;

  @Column({ type: 'varchar', default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Column({ nullable: true, length: 20 })
  asset: string | null;

  @Column({ type: 'varchar', nullable: true })
  operator: AlertOperator | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  threshold: number | null;

  @Column({ type: 'varchar', nullable: true })
  changeType: PortfolioChangeType | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  changeThreshold: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  referenceValue: number | null;

  @Column({ type: 'simple-array' })
  channels: NotificationChannel[];

  @Column({ type: 'int', default: 60 })
  cooldownMinutes: number;

  @Column({ type: 'datetime', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ type: 'int', default: 0 })
  triggerCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
