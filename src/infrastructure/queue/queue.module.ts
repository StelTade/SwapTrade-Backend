import { Module } from '@nestjs/common';
import { QueueModule as OriginalQueueModule } from '../../queue/queue.module';
import { HorizontalScalingModule } from '../../queue/horizontal-scaling.module';

/**
 * Infrastructure Queue Facade Module
 *
 * Wraps the original QueueModule and HorizontalScalingModule from src/queue/.
 * Provides: QueueService, QueueMonitoringService, ExponentialBackoffService,
 *           DeadLetterQueueService, QueueAnalyticsService, SchedulerService,
 *           SchedulerFailoverService, HorizontalScaling services
 */
@Module({
  imports: [
    OriginalQueueModule,
    HorizontalScalingModule,
  ],
  exports: [
    OriginalQueueModule,
    HorizontalScalingModule,
  ],
})
export class InfrastructureQueueModule {}
