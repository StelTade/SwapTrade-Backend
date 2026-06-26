import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueName } from '../queue/queue.constants';
import { Notification } from './entities/notification.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { NotificationsService } from './services/notifications.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { PushService } from './services/push.service';
import { TemplatesService } from './services/templates.service';
import { NotificationProcessor } from './services/notification.processor';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationEventListeners } from './usage-examples';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { BulkheadService } from '../common/services/bulkhead.service';
import { CorrelationIdService } from '../common/services/correlation-id.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      UserNotificationPreferences,
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
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    SmsService,
    PushService,
    TemplatesService,
    NotificationProcessor,
    NotificationsGateway,
    NotificationEventListeners,
    CircuitBreakerService,
    BulkheadService,
    CorrelationIdService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}