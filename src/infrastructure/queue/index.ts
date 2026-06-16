/**
 * Infrastructure Queue Module
 * Bull job queue, worker management, horizontal scaling
 *
 * Facade over src/queue/ — original implementation location
 */

export { InfrastructureQueueModule } from './queue.module';
export { QueueModule } from '../../queue/queue.module';
export { HorizontalScalingModule } from '../../queue/horizontal-scaling.module';
export { QueueService } from '../../queue/queue.service';
export { QueueMonitoringService } from '../../queue/queue-monitoring.service';
export { ExponentialBackoffService } from '../../queue/exponential-backoff.service';
export { DeadLetterQueueService } from '../../queue/dead-letter-queue.service';
export { QueueAnalyticsService } from '../../queue/queue-analytics.service';
export { SchedulerService } from '../../queue/scheduler.service';
export { QueueName } from '../../queue/queue.constants';
