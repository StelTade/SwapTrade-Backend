import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AlertRule } from './entities/alert-rule.entity';
import { AlertTriggeredEvent } from './entities/alert-triggered-event.entity';
import { AlertService } from './alert.service';
import { AlertEvaluationService } from './alert-evaluation.service';
import { AlertProcessor } from './alert.processor';
import { AlertController } from './alert.controller';
import { NotificationModule } from '../notification/notification.module';
import { QueueName } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertRule, AlertTriggeredEvent]),
    BullModule.registerQueue({
      name: QueueName.ALERTS,
      defaultJobOptions: {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
    NotificationModule,
  ],
  controllers: [AlertController],
  providers: [AlertService, AlertEvaluationService, AlertProcessor],
  exports: [AlertService],
})
export class AlertModule {}
