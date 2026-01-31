# Bull Queue System - Implementation Guide

This guide explains how to integrate and use the advanced Bull queue features in your application.

## File Structure

```
src/queue/
├── queue.config.ts                  # Configuration & policies
├── exponential-backoff.service.ts   # Backoff calculations
├── dead-letter-queue.service.ts     # DLQ management
├── queue-analytics.service.ts       # Metrics & monitoring
├── queue.service.ts                 # Queue operations
├── queue.controller.ts              # User-facing endpoints
├── queue-admin.controller.ts        # Admin endpoints
├── queue.module.ts                  # Module setup
├── queue.constants.ts               # Queue names
├── queue-monitoring.service.ts      # Legacy monitoring
├── scheduler.service.ts             # Scheduled jobs
└── processors/
    ├── notification.processor.ts
    ├── email.processor.ts
    ├── report.processor.ts
    └── cleanup.processor.ts
```

## Integration Steps

### 1. Import QueueModule

The QueueModule is already configured with all the new services. Simply import it:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    QueueModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Inject Services

Services are automatically available via dependency injection:

```typescript
import { QueueService } from './queue/queue.service';
import { ExponentialBackoffService } from './queue/exponential-backoff.service';
import { DeadLetterQueueService } from './queue/dead-letter-queue.service';
import { QueueAnalyticsService } from './queue/queue-analytics.service';

@Injectable()
export class MyService {
  constructor(
    private queueService: QueueService,
    private backoffService: ExponentialBackoffService,
    private dlqService: DeadLetterQueueService,
    private analyticsService: QueueAnalyticsService,
  ) {}
}
```

### 3. Add Jobs with Proper Configuration

```typescript
import { RetryPolicy, getJobOptionsForPolicy } from './queue/queue.config';

// Simple job with default retry
const job = await this.queueService.addNotificationJob(jobData);

// Job with specific retry policy
const job = await this.queueService.addNotificationJob(
  jobData,
  getJobOptionsForPolicy(RetryPolicy.CRITICAL)
);

// Job with custom options
const job = await this.queueService.addEmailJob(jobData, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  priority: 1,
  timeout: 30000,
});
```

### 4. Handle Retries in Processors

```typescript
import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { ExponentialBackoffService } from '../exponential-backoff.service';
import { DeadLetterQueueService, DLQReason } from '../dead-letter-queue.service';

@Processor(QueueName.NOTIFICATIONS)
export class NotificationProcessor {
  constructor(
    private backoffService: ExponentialBackoffService,
    private dlqService: DeadLetterQueueService,
  ) {}

  @Process()
  async process(job: Job): Promise<void> {
    try {
      // Your processing logic
      await doWork(job.data);
    } catch (error) {
      // Check if retryable
      if (!this.backoffService.isRetryableError(error)) {
        // Send non-retryable errors directly to DLQ
        await this.dlqService.addToDLQ(
          job,
          error,
          DLQReason.NON_RETRYABLE_ERROR,
          job.queue.name
        );
        throw error;
      }

      // Let Bull retry with exponential backoff
      throw error;
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error): Promise<void> {
    const backoffResult = this.backoffService.calculateRetryDelay(
      job,
      RetryPolicy.NORMAL
    );

    if (!backoffResult.shouldRetry) {
      // Move to DLQ after max retries
      await this.dlqService.addToDLQ(
        job,
        error,
        DLQReason.MAX_RETRIES_EXCEEDED,
        job.queue.name
      );
    }

    this.logger.error(
      `Job ${job.id} failed. ${
        backoffResult.shouldRetry
          ? `Will retry in ${backoffResult.delay}ms`
          : 'Max retries exceeded'
      }`,
    );
  }
}
```

### 5. Set Up Monitoring

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueAnalyticsService } from './queue-analytics.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';

@Injectable()
export class QueueMonitoringSetup {
  private readonly logger = new Logger(QueueMonitoringSetup.name);

  constructor(
    private analyticsService: QueueAnalyticsService,
    private dlqService: DeadLetterQueueService,
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    // Monitor queue health every minute
    setInterval(() => this.checkQueueHealth(), 60000);

    // Subscribe to DLQ events
    this.dlqService.onDLQItem((item) => {
      this.logger.warn(`DLQ Alert: Job ${item.jobId} failed permanently`, {
        queue: item.queueName,
        error: item.error,
      });
    });
  }

  private checkQueueHealth(): void {
    for (const queueName of Object.values(QueueName)) {
      const health = this.analyticsService.getQueueHealth(queueName);

      if (health.status === 'critical') {
        this.logger.error(
          `CRITICAL: Queue ${queueName} has issues`,
          health.issues,
        );
        // Send alert to admins
      } else if (health.status === 'warning') {
        this.logger.warn(
          `WARNING: Queue ${queueName} may have issues`,
          health.issues,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyDLQReport(): Promise<void> {
    const dlqStats = this.dlqService.getDLQStats();

    this.logger.log('Daily DLQ Report:', dlqStats);

    // Alert if significant DLQ items
    Object.entries(dlqStats).forEach(([queue, stats]) => {
      if (stats.count > 0) {
        this.logger.warn(
          `${queue} has ${stats.count} items in DLQ. Oldest: ${stats.oldestItem?.failedAt}`,
        );
      }
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyAnalyticsSnapshot(): Promise<void> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

    const report = this.analyticsService.generateAnalyticsReport(
      startTime,
      endTime,
    );

    this.logger.log('Hourly Analytics Report:', {
      period: `${startTime} to ${endTime}`,
      aggregated: report.aggregated,
      alerts: report.alerts,
    });
  }
}
```

### 6. Configure Admin Routes (Optional - with Auth)

If you have authentication:

```typescript
// queue-admin.controller.ts - Uncomment guard decorators

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('queue-admin')
@ApiBearerAuth()
@Controller('api/admin/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class QueueAdminController {
  // ... endpoints
}
```

### 7. Configure Health Checks (Optional)

```typescript
import { HealthCheckService, HealthIndicator } from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    private analyticsService: QueueAnalyticsService,
  ) {
    super();
  }

  async checkQueueHealth() {
    let allHealthy = true;
    const results = {};

    for (const queueName of Object.values(QueueName)) {
      const health = this.analyticsService.getQueueHealth(queueName);
      results[queueName] = health;

      if (health.status !== 'healthy') {
        allHealthy = false;
      }
    }

    return this.getStatus('queue', allHealthy, results);
  }
}

// In your health controller:
@Get('health/queue')
@HealthCheck()
async checkQueueHealth() {
  return this.health.check([
    () => this.queueHealthIndicator.checkQueueHealth(),
  ]);
}
```

## Configuration Examples

### Configure Retry Policies

Edit `queue.config.ts` to customize retry behavior:

```typescript
export const RETRY_POLICIES: Record<RetryPolicy, RetryPolicyConfig> = {
  [RetryPolicy.CRITICAL]: {
    maxAttempts: 10,        // More attempts
    baseDelay: 500,         // Faster initial retry
    maxDelay: 120000,       // Max 2 minutes
    backoffMultiplier: 2.0,
    jitterFactor: 0.05,
  },
  // ... other policies
};
```

### Configure DLQ Behavior

```typescript
// In your module or service setup
constructor(private dlqService: DeadLetterQueueService) {
  this.dlqService.setDLQConfig({
    enabled: true,
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    notifyOnFailure: true,
    alertThreshold: 50, // Alert if DLQ > 50 items
  });
}
```

### Configure Health Thresholds

```typescript
constructor(private analyticsService: QueueAnalyticsService) {
  this.analyticsService.setHealthThresholds({
    warningWaitingCount: 2000,
    criticalWaitingCount: 10000,
    warningFailureRate: 10,
    criticalFailureRate: 25,
    maxProcessingTimeMs: 600000, // 10 minutes
  });
}
```

## Testing

### Test Endpoints

Use the test endpoints to verify configuration:

```bash
# Test notification job
curl -X POST http://localhost:3000/api/queue/test/notification \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-1", "message": "Test"}'

# Test email job
curl -X POST http://localhost:3000/api/queue/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test"}'
```

### Simulate Failures

```typescript
// In a test processor
@Process()
async processTest(job: Job): Promise<void> {
  if (job.data.simulateError) {
    throw new Error('Simulated error for testing retry logic');
  }

  // Normal processing
}
```

## Troubleshooting

### New Services Not Injected

**Problem**: "Cannot find module" or injection errors

**Solution**:
1. Verify services are exported from `queue.module.ts`
2. Ensure QueueModule is imported in your module
3. Clear node_modules and reinstall: `npm install`

### Jobs Not Being Retried

**Problem**: Failed jobs immediately go to DLQ

**Solution**:
1. Check job options have `attempts > 1`
2. Verify backoff configuration in queue setup
3. Ensure error is retryable (not validation error)
4. Check processor isn't catching and re-throwing incorrectly

### Metrics Not Recording

**Problem**: Empty metrics history or no health status

**Solution**:
1. Verify `recordMetrics()` is being called
2. Check queue processors are running
3. Ensure jobs are being processed or failing
4. Monitor Redis connection

### DLQ Items Not Appearing

**Problem**: Failed jobs not in DLQ

**Solution**:
1. Verify DLQ is enabled: `dlqService.getDLQConfig()`
2. Check `addToDLQ()` is called in processor error handlers
3. Ensure max retries are actually exceeded
4. Check job attempt counts: `job.attemptsMade >= maxAttempts`

## Performance Tuning

### Optimize for High Volume

```typescript
// Increase concurrency for fast jobs
BullModule.registerQueue({
  name: QueueName.NOTIFICATIONS,
  defaultJobOptions: {
    attempts: 3,
    timeout: 5000, // Quick timeout
  },
  limiter: {
    max: 1000,    // High throughput
    duration: 1000,
  },
  settings: {
    lockDuration: 5000,  // Shorter lock
    stalledInterval: 5000,
  },
});
```

### Optimize for Reliability

```typescript
// Increase retry attempts and timeouts for important jobs
BullModule.registerQueue({
  name: QueueName.EMAILS,
  defaultJobOptions: {
    attempts: 5,
    timeout: 60000, // Long timeout for reliability
    maxStalledCount: 2,
  },
  limiter: {
    max: 50,       // Modest throughput
    duration: 1000,
  },
});
```

## Monitoring Dashboard Integration

The system provides data for external dashboards:

```typescript
// Get data for dashboard
const dashboardData = {
  queues: await this.queueService.getAllQueueMetrics(),
  dlq: this.dlqService.getDLQStats(),
  health: Object.fromEntries(
    Object.values(QueueName).map(q => [
      q,
      this.analyticsService.getQueueHealth(q)
    ])
  ),
};
```

This can be consumed by monitoring systems like Grafana, DataDog, New Relic, etc.

## Production Checklist

- [ ] Configured appropriate retry policies
- [ ] Set up DLQ monitoring and alerts
- [ ] Configured health thresholds
- [ ] Implemented idempotent processors
- [ ] Set up monitoring jobs (hourly/daily reports)
- [ ] Configured job timeouts appropriately
- [ ] Set up admin dashboard access control
- [ ] Configured Redis persistence
- [ ] Tested failure scenarios
- [ ] Documented queue operational procedures
- [ ] Set up log aggregation
- [ ] Configured metrics export
