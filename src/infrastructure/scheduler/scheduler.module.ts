import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Infrastructure Scheduler Facade Module
 *
 * Wraps NestJS ScheduleModule and scheduler services from src/queue/.
 * Scheduler services are provided through the Queue module.
 * Provides: ScheduleModule (cron), SchedulerService, SchedulerFailoverService
 *           (via InfrastructureQueueModule)
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  exports: [ScheduleModule],
})
export class InfrastructureSchedulerModule {}
