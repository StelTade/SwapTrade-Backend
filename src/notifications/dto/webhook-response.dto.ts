import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { WebhookStatus } from '../entities/webhook-subscription.entity';

export class WebhookResponseDto {
  id: string;
  callbackUrl: string;
  /** First 8 chars of the secret + '...' for display */
  secretPreview: string;
  status: WebhookStatus;
  events: NotificationEventType[];
  description?: string;
  maxFailures: number;
  consecutiveFailures: number;
  lastSuccessfulDeliveryAt?: Date;
  lastFailedDeliveryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookDeliveryLogResponseDto {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: NotificationEventType;
  status: string;
  responseStatusCode?: number | null;
  durationMs?: number;
  attemptNumber: number;
  maxAttempts: number;
  errorMessage?: string | null;
  nextRetryAt?: Date;
  lastAttemptedAt?: Date;
  createdAt: Date;
}
