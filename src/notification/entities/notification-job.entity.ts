import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationJobStatus {
  Pending = 'PENDING',
  Processing = 'PROCESSING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Scheduled = 'SCHEDULED',
}

@Entity()
export class NotificationJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  notificationId: number;

  @Column({ type: 'enum', enum: NotificationJobStatus, default: NotificationJobStatus.Pending })
  status: NotificationJobStatus;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRunAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
