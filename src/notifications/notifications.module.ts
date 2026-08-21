import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueName } from '../queue/queue.constants';

// Entities
import { Notification } from './entities/notification.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryLog } from './entities/webhook-delivery-log.entity';

// Services
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { PushService } from './services/push.service';
import { TemplatesService } from './services/templates.service';
import { NotificationProcessor } from './services/notification.processor';
import { WebhooksService } from './services/webhooks.service';
import { WebhookDeliveryProcessor } from './services/webhook-delivery.processor';
import { WebhookCleanupService } from './services/webhook-cleanup.service';

// Gateways
import { NotificationsGateway } from './gateways/notifications.gateway';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';
import { WebhooksController } from './controllers/webhooks.controller';

// Event listeners
import { NotificationEventListeners } from './usage-examples';

// Shared services
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { BulkheadService } from '../common/services/bulkhead.service';
import { CorrelationIdService } from '../common/services/correlation-id.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      UserNotificationPreferences,
      WebhookSubscription,
      WebhookDeliveryLog,
    ]),
    BullModule.registerQueue({
      name: QueueName.NOTIFICATIONS,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('WEBHOOK_TIMEOUT_MS', 10000),
        maxRedirects: 3,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule,
  ],
  controllers: [NotificationsController, WebhooksController],
  providers: [
    // Existing notification services
    NotificationsService,
    EmailService,
    SmsService,
    PushService,
    TemplatesService,
    NotificationProcessor,
    NotificationsGateway,

    // Webhook services
    WebhooksService,
    WebhookDeliveryProcessor,
    WebhookCleanupService,

    // Event listeners
    NotificationEventListeners,

    // Shared infrastructure
    CircuitBreakerService,
    BulkheadService,
    CorrelationIdService,
  ],
  exports: [NotificationsService, WebhooksService],
})
export class NotificationsModule {}
