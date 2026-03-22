import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { WaitlistNotificationService } from './waitlist-notification.service';
import { EmailQueueService } from './email-queue.service';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationJob } from './entities/notification-job.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { EmailJob } from './entities/email-job.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationTemplate,
      NotificationJob,
      UserNotificationPreferences,
      EmailJob,
    ]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    WaitlistNotificationService,
    EmailQueueService,
  ],
  exports: [
    NotificationService,
    WaitlistNotificationService,
    EmailQueueService,
  ],
})
export class NotificationModule {}
