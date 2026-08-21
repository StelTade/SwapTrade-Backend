import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Entity('webhook_delivery_logs')
@Index(['subscriptionId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['status'])
export class WebhookDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  subscriptionId: string;

  @Column()
  @Index()
  userId: string;

  /** Unique event ID for idempotency */
  @Column()
  eventId: string;

  @Column({ type: 'varchar', enum: NotificationEventType })
  eventType: NotificationEventType;

  @Column({ type: 'varchar', enum: WebhookDeliveryStatus, default: WebhookDeliveryStatus.PENDING })
  status: WebhookDeliveryStatus;

  /** The JSON payload sent to the callback URL */
  @Column('jsonb')
  payload: Record<string, any>;

  /** HMAC-SHA256 signature sent in the X-Webhook-Signature header */
  @Column({ nullable: true })
  signature: string;

  /** HTTP status code returned by the callback URL */
  @Column({ nullable: true })
  responseStatusCode?: number | null;

  /** Response body from the callback URL (truncated to 1KB) */
  @Column({ type: 'text', nullable: true })
  responseBody?: string | null;

  /** Time taken for the HTTP request in milliseconds */
  @Column({ nullable: true })
  durationMs: number;

  /** Current attempt number (1-based) */
  @Column({ default: 1 })
  attemptNumber: number;

  /** Maximum attempts allowed */
  @Column({ default: 5 })
  maxAttempts: number;

  /** Error message if delivery failed */
  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  /** When the next retry should occur */
  @Column({ nullable: true })
  nextRetryAt: Date;

  /** Timestamp when this delivery was last attempted */
  @Column({ nullable: true })
  lastAttemptedAt: Date;

  /** Whether this delivery is retained or eligible for cleanup */
  @Column({ default: true })
  retained: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
