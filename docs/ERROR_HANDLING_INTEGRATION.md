# Error Handling System - Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the production-grade error handling system into the SwapTrade-Backend codebase.

## Prerequisites

- Node.js 18+
- NestJS 11+
- TypeORM configured
- Bull Queue configured

## Installation Steps

### 1. Install Dependencies

Dependencies have been added to `package.json`:
- `opossum`: Circuit breaker implementation
- `p-retry`: Retry logic utilities
- `p-limit`: Concurrency limiting
- `uuid`: Correlation ID generation

```bash
npm install
```

### 2. Import Error Handling Module

Update your `app.module.ts`:

```typescript
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ErrorHandlingModule } from './common/error-handling.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // ... other modules
    ErrorHandlingModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

### 3. Integrate with Swap Service

Update `src/swap/swap.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { RetryService } from '../common/services/retry.service';
import { SagaService, SagaStep } from '../common/services/saga.service';
import { DeadLetterQueueService } from '../common/services/dead-letter-queue.service';
import { CorrelationIdService } from '../common/services/correlation-id.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly retryService: RetryService,
    private readonly sagaService: SagaService,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly correlationIdService: CorrelationIdService,
  ) {
    this.setupCircuitBreaker();
    this.setupDLQ();
  }

  private setupCircuitBreaker(): void {
    // Setup circuit breaker for external DEX API calls
    this.circuitBreakerService.register(
      this.callExternalDexAPI.bind(this),
      {
        name: 'dex-api-swap',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
      },
    );
  }

  private setupDLQ(): void {
    this.deadLetterQueueService.registerDLQ('swaps', {
      maxRetries: 3,
      retentionDays: 30,
      notifyOnThreshold: 50,
    });
  }

  async executeSwap(dto: CreateSwapDto): Promise<any> {
    const correlationId = this.correlationIdService.getCorrelationId();
    this.logger.log(
      `[${correlationId}] Executing swap: ${dto.from} -> ${dto.to} (${dto.amount})`,
    );

    // Use Saga pattern for atomic operations
    const steps: SagaStep[] = [
      {
        name: 'lockFunds',
        action: () => this.lockUserFunds(dto.userId, dto.from, dto.amount),
        compensation: (lockId) => this.unlockFunds(lockId),
      },
      {
        name: 'callDexAPI',
        action: () => this.executeSwapViaCircuitBreaker(dto.from, dto.to, dto.amount),
        compensation: (swapId) => this.reverseSwapOnDex(swapId),
      },
      {
        name: 'updateBalances',
        action: () => this.updateBalances(dto),
        compensation: () => this.revertBalances(dto),
      },
    ];

    const sagaResult = await this.sagaService.executeSaga('token-swap', steps);

    if (!sagaResult.success) {
      // Send to dead letter queue
      await this.deadLetterQueueService.sendToDLQ(
        'swaps',
        undefined,
        'executeSwap',
        dto,
        sagaResult.error!,
        1,
      );

      this.logger.error(
        `[${correlationId}] Swap failed at step: ${sagaResult.failedStep}`,
      );
      throw new Error(`Swap failed: ${sagaResult.failedStep}`);
    }

    this.logger.log(
      `[${correlationId}] Swap completed in ${sagaResult.executionTimeMs}ms`,
    );

    return {
      userId: dto.userId,
      from: { asset: dto.from, balance: /* ... */ },
      to: { asset: dto.to, balance: /* ... */ },
    };
  }

  private async executeSwapViaCircuitBreaker(
    from: string,
    to: string,
    amount: number,
  ): Promise<string> {
    return this.circuitBreakerService.execute(
      'dex-api-swap',
      () => this.callExternalDexAPI(from, to, amount),
    );
  }

  private async callExternalDexAPI(
    from: string,
    to: string,
    amount: number,
  ): Promise<string> {
    // External DEX API call with retry logic
    const result = await this.retryService.executeWithRetry(
      async () => {
        // Make actual API call
        const response = await fetch('https://dex-api.example.com/swap', {
          method: 'POST',
          body: JSON.stringify({ from, to, amount }),
          headers: {
            ...this.correlationIdService.getContextHeaders(),
          },
        });

        if (!response.ok) {
          throw new Error(`DEX API error: ${response.statusText}`);
        }

        return response.json();
      },
      'moderate',
      'callExternalDexAPI',
    );

    if (!result.success) {
      throw result.error;
    }

    return result.result.swapId;
  }

  private async lockUserFunds(
    userId: string,
    asset: string,
    amount: number,
  ): Promise<string> {
    // Lock implementation
    return `lock_${Date.now()}`;
  }

  private async unlockFunds(lockId: string): Promise<void> {
    // Unlock implementation
  }

  private async reverseSwapOnDex(swapId: string): Promise<void> {
    // Reverse swap implementation
  }

  private async updateBalances(dto: CreateSwapDto): Promise<void> {
    // Update balances in database
  }

  private async revertBalances(dto: CreateSwapDto): Promise<void> {
    // Revert balances
  }
}
```

### 4. Integrate with Queue Service

Update `src/queue/queue.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { BulkheadService } from '../common/services/bulkhead.service';
import { DeadLetterQueueService } from '../common/services/dead-letter-queue.service';
import { RetryService } from '../common/services/retry.service';
import { ErrorMonitoringService } from '../common/services/error-monitoring.service';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QueueName.NOTIFICATIONS)
    private notificationQueue: Queue<NotificationJobData>,
    @InjectQueue(QueueName.EMAILS)
    private emailQueue: Queue<EmailJobData>,
    @InjectQueue(QueueName.REPORTS)
    private reportQueue: Queue<ReportJobData>,
    @InjectQueue(QueueName.CLEANUP)
    private cleanupQueue: Queue<CleanupJobData>,
    private readonly bulkheadService: BulkheadService,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly retryService: RetryService,
    private readonly errorMonitoringService: ErrorMonitoringService,
  ) {
    this.setupBulkheads();
    this.setupDLQs();
  }

  private setupBulkheads(): void {
    this.bulkheadService.createBulkhead({
      name: 'notification-processor',
      maxConcurrent: 10,
    });

    this.bulkheadService.createBulkhead({
      name: 'email-processor',
      maxConcurrent: 5,
    });

    this.bulkheadService.createBulkhead({
      name: 'report-processor',
      maxConcurrent: 3,
    });
  }

  private setupDLQs(): void {
    this.deadLetterQueueService.registerDLQ('notifications', {
      maxRetries: 3,
      retentionDays: 7,
      notifyOnThreshold: 50,
    });

    this.deadLetterQueueService.registerDLQ('emails', {
      maxRetries: 5,
      retentionDays: 14,
      notifyOnThreshold: 100,
    });

    this.deadLetterQueueService.registerDLQ('reports', {
      maxRetries: 2,
      retentionDays: 30,
      notifyOnThreshold: 10,
    });

    // Subscribe to DLQ messages for alerts
    this.deadLetterQueueService.onDLQMessage('notifications', (msg) => {
      this.logger.error(`Critical: Notification failed - ${msg.functionName}`, msg);
      this.errorMonitoringService.recordError(
        new Error(msg.error.message),
        {
          correlationId: msg.correlationId,
          endpoint: 'notifications-queue',
          severity: 'HIGH' as any,
        },
      );
    });
  }

  async addNotificationJob(
    data: NotificationJobData,
    options?: JobOptions,
  ): Promise<Job<NotificationJobData>> {
    try {
      const jobOptions: JobOptions = {
        ...options,
        priority: this.getPriority(data.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep for DLQ routing
      };

      const job = await this.notificationQueue.add(data, jobOptions);

      this.logger.log(
        `Notification job added: ${job.id} for user ${data.userId}`,
      );

      return job;
    } catch (error) {
      this.logger.error(`Failed to add notification job: ${error}`);
      throw error;
    }
  }

  // Add job processor with error handling and bulkhead
  async processNotificationJob(jobData: NotificationJobData): Promise<void> {
    return this.bulkheadService.execute(
      'notification-processor',
      async () => {
        const result = await this.retryService.executeWithRetry(
          () => this.sendNotification(jobData),
          'moderate',
          'processNotificationJob',
        );

        if (!result.success) {
          await this.deadLetterQueueService.sendToDLQ(
            'notifications',
            undefined,
            'processNotificationJob',
            jobData,
            result.error!,
            result.attempts,
          );

          throw result.error;
        }
      },
      'processNotificationJob',
    );
  }

  private async sendNotification(data: NotificationJobData): Promise<void> {
    // Notification sending logic
  }

  private getPriority(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 10;
      case 'low':
        return 1;
      default:
        return 5;
    }
  }
}
```

### 5. Setup Job Consumers with Error Handling

Create `src/queue/consumers/notification.consumer.ts`:

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QueueService } from '../queue.service';

@Processor('notifications')
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(private readonly queueService: QueueService) {}

  @Process()
  async handleNotification(job: Job): Promise<void> {
    try {
      this.logger.log(`Processing notification job ${job.id}`);
      await this.queueService.processNotificationJob(job.data);
    } catch (error) {
      this.logger.error(`Failed to process notification job ${job.id}`, error);
      throw error; // Rethrow to trigger retry or DLQ
    }
  }
}
```

### 6. Access Error Dashboard

After integration, the error monitoring dashboard is available at:

```
GET  /api/dashboard/summary                    - Dashboard summary
GET  /api/dashboard/errors/metrics             - Error metrics
GET  /api/dashboard/errors/stats               - Error statistics
GET  /api/dashboard/errors/recent              - Recent errors
GET  /api/dashboard/circuit-breakers           - Circuit breaker status
GET  /api/dashboard/bulkheads                  - Bulkhead status
GET  /api/dashboard/dlq/stats                  - DLQ statistics
GET  /api/dashboard/health                     - System health
```

## Configuration

### Circuit Breaker Configuration

```typescript
// Aggressive for resilient services
circuitBreakerService.register(fn, {
  name: 'api-name',
  timeout: 3000,
  errorThresholdPercentage: 50,
  volumeThreshold: 10,
});

// Conservative for critical services
circuitBreakerService.register(fn, {
  name: 'critical-api',
  timeout: 5000,
  errorThresholdPercentage: 30,
  volumeThreshold: 5,
});
```

### Retry Policy Configuration

```typescript
// Aggressive: Fast retries
await retryService.executeWithRetry(fn, 'aggressive');

// Moderate: Balanced (default)
await retryService.executeWithRetry(fn, 'moderate');

// Conservative: Slow retries for critical operations
await retryService.executeWithRetry(fn, 'conservative');

// Custom policy
const customPolicy = retryService.createCustomPolicy(
  maxRetries: 4,
  initialDelayMs: 300,
  maxDelayMs: 20000,
  multiplier: 2.5,
  jitterFactor: 0.2,
);
```

### Bulkhead Configuration

```typescript
// API bulkhead
bulkheadService.createBulkhead({
  name: 'external-api',
  maxConcurrent: 20,
});

// Database bulkhead
bulkheadService.createBulkhead({
  name: 'database-write',
  maxConcurrent: 5,
});
```

### DLQ Configuration

```typescript
// High-throughput queue
deadLetterQueueService.registerDLQ('queue-name', {
  maxRetries: 5,
  retentionDays: 7,
  notifyOnThreshold: 50,
});

// Critical queue
deadLetterQueueService.registerDLQ('critical-queue', {
  maxRetries: 10,
  retentionDays: 30,
  notifyOnThreshold: 10,
});
```

## Best Practices

### 1. Use Correlation IDs Everywhere

```typescript
const correlationId = this.correlationIdService.getCorrelationId();
this.logger.log(`[${correlationId}] Operation started`);
```

### 2. Error Categorization

Errors are automatically categorized as transient or permanent. Transient errors are retried automatically.

### 3. Saga Pattern for Distributed Transactions

Use Saga for operations spanning multiple services to ensure consistency.

### 4. Monitor DLQ Messages

Set up alerts for DLQ threshold violations to catch issues early.

### 5. Periodic Cleanup

Schedule regular cleanup of old DLQ and error events:

```typescript
// In a scheduled task
this.deadLetterQueueService.cleanupOldMessages();
this.errorMonitoringService.clearOldEvents(24 * 60 * 60 * 1000);
```

## Testing

### Unit Tests

```bash
npm test -- error-handling.spec.ts
```

### Chaos Engineering Tests

```bash
npm test -- chaos-engineering.spec.ts
```

### Integration Tests

```bash
npm test:e2e
```

## Troubleshooting

### Circuit Breaker Keeps Opening

1. Check service health
2. Review error dashboard
3. Adjust error threshold percentage
4. Reset breaker: `POST /api/dashboard/circuit-breakers/{name}/reset`

### DLQ Messages Not Processing

1. Review failing jobs in dashboard
2. Check error logs
3. Implement retry logic
4. Fix underlying issue
5. Retry jobs manually

### High Error Rate

1. Check system health dashboard
2. Review error distribution
3. Check circuit breaker status
4. Monitor service dependencies

## Support

For issues or questions, check:
1. Error dashboard at `/api/dashboard/summary`
2. Error logs with correlation IDs
3. Circuit breaker status
4. DLQ messages and statistics
5. Chaos engineering tests for edge cases

## References

- [ERROR_HANDLING_GUIDE.md](./ERROR_HANDLING_GUIDE.md)
- [Integration Examples](../src/common/examples/error-handling-examples.ts)
- [Opossum Documentation](https://github.com/noderpolish/opossum)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
