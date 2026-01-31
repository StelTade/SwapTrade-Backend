// src/queue/queue.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationJobProcessor } from './processors/notification.processor';
import { EmailJobProcessor } from './processors/email.processor';
import { ReportJobProcessor } from './processors/report.processor';
import { CleanupJobProcessor } from './processors/cleanup.processor';
import { QueueService } from './queue.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { SchedulerService } from './scheduler.service';
import { ExponentialBackoffService } from './exponential-backoff.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { QueueAnalyticsService } from './queue-analytics.service';
import { QueueController } from './queue.controller';
import { QueueAdminController } from './queue-admin.controller';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { TradingModule } from '../trading/trading.module';
import { QueueName } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 24 * 3600,
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 3600,
          },
        },
        settings: {
          lockDuration: 30000,
          stalledInterval: 30000,
          maxStalledCount: 1,
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue({
      name: QueueName.NOTIFICATIONS,
      defaultJobOptions: {
        priority: 2,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
      limiter: { max: 100, duration: 1000 },
      settings: { lockDuration: 10000 },
    }),

    BullModule.registerQueue({
      name: QueueName.EMAILS,
      defaultJobOptions: {
        priority: 3,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        timeout: 30000,
      },
      limiter: { max: 50, duration: 1000 },
    }),

    BullModule.registerQueue({
      name: QueueName.REPORTS,
      defaultJobOptions: {
        priority: 5,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        timeout: 300000,
      },
      limiter: { max: 1, duration: 5000 },
    }),

    BullModule.registerQueue({
      name: QueueName.CLEANUP,
      defaultJobOptions: {
        priority: 10,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        timeout: 600000,
      },
    }),

    forwardRef(() => NotificationModule),
    UserModule,
    forwardRef(() => TradingModule),
  ],
  controllers: [QueueController, QueueAdminController],
  providers: [
    NotificationJobProcessor,
    EmailJobProcessor,
    ReportJobProcessor,
    CleanupJobProcessor,
    QueueService,
    QueueMonitoringService,
    SchedulerService,
    ExponentialBackoffService,
    DeadLetterQueueService,
    QueueAnalyticsService,
  ],
  exports: [
    QueueService,
    QueueMonitoringService,
    ExponentialBackoffService,
    DeadLetterQueueService,
    QueueAnalyticsService,
  ],
})
export class QueueModule {}
