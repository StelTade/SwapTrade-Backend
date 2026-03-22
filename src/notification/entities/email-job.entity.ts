/**
 * Email Job Entity - 邮件任务实体
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EmailJobStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  COMPLETED = 'completed',
  RETRYING = 'retrying',
  FAILED = 'failed',
}

export enum EmailJobPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

@Entity('email_jobs')
export class EmailJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  to: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  templateKey?: string;

  @Column({ type: 'int', nullable: true })
  userId?: number;

  @Column({
    type: 'enum',
    enum: EmailJobStatus,
    default: EmailJobStatus.PENDING,
  })
  @Index()
  status: EmailJobStatus;

  @Column({
    type: 'enum',
    enum: EmailJobPriority,
    default: EmailJobPriority.NORMAL,
  })
  priority: EmailJobPriority;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  sentAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  failedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
