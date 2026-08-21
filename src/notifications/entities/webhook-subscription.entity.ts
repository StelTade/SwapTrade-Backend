import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

@Entity('webhook_subscriptions')
@Index(['userId', 'status'])
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  callbackUrl: string;

  /**
   * HMAC-SHA256 secret used to sign webhook payloads.
   * Displayed once at creation; stored hashed for verification.
   */
  @Column()
  secret: string;

  @Column({
    type: 'varchar',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  /** Which event types this subscription is interested in. Empty = all events. */
  @Column('simple-json', { default: '[]' })
  events: NotificationEventType[];

  /** Optional description for the user's reference */
  @Column({ nullable: true })
  description: string;

  /** Maximum consecutive delivery failures before auto-disabling */
  @Column({ default: 10 })
  maxFailures: number;

  /** Current consecutive failure count (reset on success) */
  @Column({ default: 0 })
  consecutiveFailures: number;

  /** HMAC algorithm used for signing */
  @Column({ default: 'sha256' })
  signingAlgorithm: string;

  /** Timestamp of last successful delivery */
  @Column({ nullable: true })
  lastSuccessfulDeliveryAt: Date;

  /** Timestamp of last failed delivery */
  @Column({ nullable: true })
  lastFailedDeliveryAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
