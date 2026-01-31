# Bull Queue System - Advanced Features Guide

This comprehensive guide covers the enhanced Bull queue system with exponential backoff, dead letter queue (DLQ), job retries, and monitoring capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Job Retries & Exponential Backoff](#job-retries--exponential-backoff)
4. [Dead Letter Queue (DLQ)](#dead-letter-queue-dlq)
5. [Queue Analytics & Monitoring](#queue-analytics--monitoring)
6. [Admin Dashboard](#admin-dashboard)
7. [Best Practices](#best-practices)
8. [API Reference](#api-reference)

---

## Overview

The enhanced Bull queue system provides production-grade job processing with:

- **Exponential Backoff**: Intelligent retry strategies to handle transient failures
- **Dead Letter Queue**: Mechanism for handling permanently failed jobs
- **Analytics & Monitoring**: Real-time metrics and performance tracking
- **Admin Dashboard**: Comprehensive management interface
- **Health Checks**: Queue status and diagnostic endpoints

### Key Features

- ✅ Configurable retry policies with different severity levels
- ✅ Automatic exponential backoff with jitter to prevent thundering herd
- ✅ DLQ for permanently failed jobs with recovery options
- ✅ Real-time metrics and analytics
- ✅ Queue health monitoring with alerts
- ✅ Admin APIs for queue management and control
- ✅ Job-level tracking and diagnostics

---

## Architecture

### Service Components

```
┌─────────────────────────────────────────────────────────────┐
│                    QueueModule                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐  │
│  │  QueueService        │      │  Job Processors      │  │
│  │  - Add Jobs          │      │  - Notification      │  │
│  │  - Job Management    │      │  - Email             │  │
│  │  - Queue Control     │      │  - Report            │  │
│  └──────────────────────┘      │  - Cleanup           │  │
│                                └──────────────────────┘  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ExponentialBackoffService                         │  │
│  │  - Calculate backoff delays                        │  │
│  │  - Track retry attempts                           │  │
│  │  - Determine retryability                         │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  DeadLetterQueueService                            │  │
│  │  - Store permanently failed jobs                   │  │
│  │  - Recovery mechanisms                            │  │
│  │  - DLQ analytics                                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  QueueAnalyticsService                             │  │
│  │  - Metrics collection                              │  │
│  │  - Health monitoring                              │  │
│  │  - Performance analysis                           │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
       │
       ├─→ [Redis] (Job Storage)
       │
       ├─→ Controllers:
       │   - QueueController (user endpoints)
       │   - QueueAdminController (admin endpoints)
       │
       └─→ Queue Engines:
           - Notifications Queue
           - Emails Queue
           - Reports Queue
           - Cleanup Queue
```

---

## Job Retries & Exponential Backoff

### Understanding Retry Policies

The system provides four built-in retry policies with different aggressiveness levels:

#### 1. **CRITICAL** Policy
```typescript
{
  maxAttempts: 5,
  baseDelay: 1000ms,
  maxDelay: 60000ms,
  backoffMultiplier: 2.0,
  jitterFactor: 0.1
}
```

**Use cases:**
- Payment confirmations
- Critical trade notifications
- System-critical operations

**Retry schedule:**
- Attempt 1: 1000ms
- Attempt 2: 2000ms (+ jitter)
- Attempt 3: 4000ms (+ jitter)
- Attempt 4: 8000ms (+ jitter)
- Attempt 5: 16000ms (+ jitter)

#### 2. **HIGH** Policy
```typescript
{
  maxAttempts: 4,
  baseDelay: 2000ms,
  maxDelay: 45000ms,
  backoffMultiplier: 1.8,
  jitterFactor: 0.15
}
```

**Use cases:**
- Trade notifications
- Order updates
- Important alerts

#### 3. **NORMAL** Policy
```typescript
{
  maxAttempts: 3,
  baseDelay: 5000ms,
  maxDelay: 30000ms,
  backoffMultiplier: 1.5,
  jitterFactor: 0.2
}
```

**Use cases:**
- Regular emails
- Standard notifications
- Batch operations

#### 4. **LOW** Policy
```typescript
{
  maxAttempts: 1,
  baseDelay: 10000ms,
  maxDelay: 10000ms,
  backoffMultiplier: 1.0,
  jitterFactor: 0.0
}
```

**Use cases:**
- Cleanup tasks
- Logging operations
- Non-critical background jobs

### Exponential Backoff Formula

```
delay = min(
  baseDelay × (multiplier ^ attemptNumber) + jitter,
  maxDelay
)

jitter = delay × jitterFactor × random(0, 1)
```

### Why Exponential Backoff?

1. **Reduces Server Load**: Gives failing services time to recover
2. **Prevents Thundering Herd**: Jitter spreads out retry attempts
3. **Intelligent Retry**: Longer delays for persistent issues
4. **Cost Effective**: Fewer wasted retry attempts on transient failures

### Implementing Retry Logic

```typescript
import { ExponentialBackoffService } from './exponential-backoff.service';
import { RetryPolicy } from './queue.config';

@Injectable()
export class MyJobProcessor {
  constructor(
    private backoffService: ExponentialBackoffService,
  ) {}

  async processJob(job: Job): Promise<void> {
    try {
      // Job processing logic
      await doSomeWork();
    } catch (error) {
      // Check if error is retryable
      if (!this.backoffService.isRetryableError(error)) {
        throw new NonRetryableError(error.message);
      }

      // Get recommended policy based on error
      const policy = this.backoffService.getRecommendedPolicy(error);

      // Calculate backoff delay
      const backoffResult = this.backoffService.calculateRetryDelay(
        job,
        policy,
      );

      if (backoffResult.shouldRetry) {
        // Track the retry attempt
        this.backoffService.trackRetryAttempt(job.id.toString());

        this.logger.warn(
          `Job ${job.id} will retry in ${backoffResult.delay}ms`,
        );

        // Throw to trigger Bull's retry mechanism
        throw error;
      } else {
        // Max retries exceeded, send to DLQ
        throw new PermanentFailureError(
          `Job exhausted all retries: ${error.message}`,
        );
      }
    }
  }
}
```

### Non-Retryable Errors

Certain errors should not trigger retries:

- Validation errors (400)
- Not found errors (404)
- Permission errors (403)
- Authorization errors (401)

The system automatically detects these patterns:

```typescript
// Automatically determined as non-retryable
isRetryableError('Validation failed: invalid email')      // false
isRetryableError('Not found: user 123')                   // false
isRetryableError('Forbidden: insufficient permissions')   // false
isRetryableError('Unauthorized: invalid token')           // false

// Automatically recommended for retry
isRetryableError('Connection timeout')                    // CRITICAL
isRetryableError('ECONNREFUSED: connection refused')      // CRITICAL
isRetryableError('Rate limit exceeded')                   // HIGH
```

---

## Dead Letter Queue (DLQ)

The Dead Letter Queue (DLQ) is a special queue that stores jobs that have permanently failed and cannot be retried.

### DLQ Flow

```
Job Added
    ↓
Processing Attempt 1
    ├─ ✓ Success → Complete
    └─ ✗ Fail
        ↓
    Attempt 2
        ├─ ✓ Success → Complete
        └─ ✗ Fail
            ↓
        Attempt 3
            ├─ ✓ Success → Complete
            └─ ✗ Fail (Max retries exceeded)
                ↓
            → DEAD LETTER QUEUE ←
                ├─ Store failed job
                ├─ Log error details
                ├─ Alert administrators
                └─ Wait for manual recovery
```

### DLQ Configuration

```typescript
// Get current DLQ configuration
GET /api/admin/queue/dlq-config

// Response:
{
  "enabled": true,
  "maxAge": 2592000000,        // 30 days in ms
  "notifyOnFailure": true,     // Alert on permanent failures
  "alertThreshold": 100        // Alert if DLQ count > 100
}

// Update configuration
PUT /api/admin/queue/dlq-config
{
  "notifyOnFailure": true,
  "alertThreshold": 50
}
```

### DLQ Failure Reasons

Jobs can be moved to DLQ for different reasons:

```typescript
enum DLQReason {
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  NON_RETRYABLE_ERROR = 'NON_RETRYABLE_ERROR',
  STALLED = 'STALLED',
  TIMEOUT = 'TIMEOUT',
  MANUAL = 'MANUAL',
}
```

### DLQ Item Structure

```typescript
{
  jobId: string,              // Original job ID
  queueName: string,          // Which queue it came from
  jobData: any,               // Original job data
  error: string,              // Error message
  errorStack?: string,        // Stack trace
  failedAt: Date,             // When it failed
  lastAttempt: number,        // Number of attempts made
  maxAttempts: number,        // Max attempts allowed
  reason: DLQReason,          // Why it was DLQ'd
  metadata?: Record<any, any> // Additional context
}
```

### DLQ Management APIs

#### Get DLQ Items
```bash
# Get latest 50 DLQ items for a queue
GET /api/admin/queue/dlq/notifications

# Get specific DLQ item
GET /api/admin/queue/dlq/notifications/{jobId}

# Get DLQ statistics
GET /api/admin/queue/dlq-stats

# Response:
{
  "notifications": {
    "count": 5,
    "oldestItem": { ... }
  },
  "emails": {
    "count": 2,
    "oldestItem": { ... }
  }
}
```

#### Recover a Failed Job
```bash
# Attempt to recover and retry a job
POST /api/admin/queue/dlq/notifications/{jobId}/recover

# Response:
{
  "success": true,
  "message": "Job recovered and re-queued",
  "jobId": "123",
  "queueName": "notifications"
}
```

#### Remove DLQ Item
```bash
# Remove a specific DLQ item
DELETE /api/admin/queue/dlq/notifications/{jobId}

# Clear entire DLQ for a queue
DELETE /api/admin/queue/dlq/notifications

# Response:
{
  "message": "DLQ cleared",
  "queueName": "notifications",
  "itemsRemoved": 15
}
```

### DLQ Monitoring & Alerts

DLQ automatically generates alerts when:

1. **Item added to DLQ**: Logged and can trigger admin notification
2. **Threshold exceeded**: Alert if DLQ item count exceeds configured threshold
3. **Old items found**: Items older than `maxAge` are automatically cleaned up

Subscribe to DLQ events:

```typescript
import { DeadLetterQueueService } from './dead-letter-queue.service';

constructor(private dlqService: DeadLetterQueueService) {
  // Subscribe to DLQ events
  this.dlqService.onDLQItem((item) => {
    console.log(`Job ${item.jobId} moved to DLQ: ${item.error}`);
    // Send alerts, notifications, etc.
  });
}
```

---

## Queue Analytics & Monitoring

### Real-Time Metrics

The analytics service collects comprehensive metrics for each queue:

```typescript
{
  timestamp: Date,
  queueName: string,
  activeJobs: number,           // Currently processing
  waitingJobs: number,          // Waiting to process
  completedJobs: number,        // Successfully completed
  failedJobs: number,           // Permanently failed
  delayedJobs: number,          // Scheduled for later
  stalledJobs: number,          // Stuck/unresponsive
  isPaused: boolean,            // Queue paused?
  averageProcessingTime: number,  // ms per job
  averageWaitTime: number,      // ms in queue
  successRate: number,          // %
  failureRate: number,          // %
  completionRate: number        // jobs/minute
}
```

### Health Status Levels

Queues are monitored and classified as:

```typescript
type QueueStatus = 'healthy' | 'warning' | 'critical';
```

**Healthy**: Everything operating normally
**Warning**: Metrics approaching thresholds
**Critical**: Action required immediately

### Health Check Thresholds (Configurable)

```typescript
{
  warningWaitingCount: 1000,        // Alert if > 1000 waiting
  criticalWaitingCount: 5000,       // Critical if > 5000 waiting
  warningFailureRate: 5,            // Alert if > 5% failures
  criticalFailureRate: 10,          // Critical if > 10% failures
  maxProcessingTimeMs: 300000       // Alert if avg > 5 minutes
}
```

### Analytics APIs

#### Get Current Metrics
```bash
# Get metrics for all queues
GET /api/admin/queue/metrics/all

# Get metrics for specific queue
GET /api/admin/queue/metrics/notifications

# Response:
{
  "timestamp": "2024-01-31T10:30:00Z",
  "queueName": "notifications",
  "activeJobs": 15,
  "waitingJobs": 245,
  "completedJobs": 15342,
  "failedJobs": 12,
  "successRate": 99.92,
  "failureRate": 0.08,
  "averageProcessingTime": 542
}
```

#### Get Metrics History
```bash
# Get last 100 metric snapshots
GET /api/admin/queue/metrics/notifications/history?limit=100

# Returns array of metrics snapshots over time
```

#### Generate Analytics Report
```bash
POST /api/admin/queue/analytics/report
{
  "startTime": "2024-01-30T00:00:00Z",
  "endTime": "2024-01-31T00:00:00Z"
}

# Response includes:
# - Metrics for each queue in period
# - Aggregated statistics
# - Alerts that occurred
# - Period duration and date range
```

#### Get Queue Health
```bash
# Get health for all queues
GET /api/admin/queue/health/all

# Get health for specific queue
GET /api/admin/queue/health/notifications

# Response:
{
  "status": "warning",
  "issues": [
    "Warning: 1,245 waiting jobs exceeds threshold of 1,000",
    "Warning: Average processing time 312,000ms exceeds threshold of 300,000ms"
  ],
  "thresholds": { ... }
}
```

#### Update Health Thresholds
```bash
PUT /api/admin/queue/health-thresholds
{
  "warningWaitingCount": 2000,
  "criticalWaitingCount": 10000,
  "warningFailureRate": 10,
  "criticalFailureRate": 20
}
```

---

## Admin Dashboard

The admin dashboard provides a comprehensive interface for queue management.

### Dashboard Endpoints

#### Overview Dashboard
```bash
GET /api/admin/queue/dashboard

# Returns:
{
  "timestamp": "2024-01-31T10:30:00Z",
  "queues": {
    "notifications": { "active": 15, "waiting": 245, ... },
    "emails": { "active": 8, "waiting": 120, ... },
    "reports": { "active": 0, "waiting": 2, ... },
    "cleanup": { "active": 0, "waiting": 0, ... }
  },
  "dlq": {
    "notifications": { "count": 5, "oldestItem": ... },
    "emails": { "count": 2, "oldestItem": ... }
  },
  "health": {
    "notifications": { "status": "healthy", "issues": [] },
    "emails": { "status": "warning", "issues": [...] }
  }
}
```

#### System Health Diagnostics
```bash
GET /api/admin/queue/system/health

# Returns overall system status and per-queue details
GET /api/admin/queue/diagnostics

# Returns comprehensive diagnostics including metrics, health, DLQ, policies
```

### Queue Control Operations

#### Pause Queue
```bash
POST /api/admin/queue/control/notifications/pause

# Stops processing jobs but keeps them in queue
# Use when: Debugging, maintenance, external service down
```

#### Resume Queue
```bash
POST /api/admin/queue/control/notifications/resume

# Resumes processing of paused queue
```

#### Empty Queue
```bash
DELETE /api/admin/queue/control/notifications

# Removes all jobs from queue (careful: cannot be undone!)
# Use when: Emergency cleanup, corrupted job data
```

#### Drain Queue
```bash
POST /api/admin/queue/control/notifications/drain

# Waits for all jobs to complete then removes them
# Safe operation, preserves completed jobs
```

### Job Management

#### Get Job Details
```bash
GET /api/admin/queue/jobs/notifications/{jobId}

# Returns:
{
  "id": "123",
  "status": "failed",
  "data": { ... },
  "attempts": 3,
  "maxAttempts": 3,
  "error": "Connection timeout",
  "createdAt": "2024-01-31T10:00:00Z",
  "finishedOn": "2024-01-31T10:05:00Z"
}
```

#### Retry Failed Job
```bash
POST /api/admin/queue/jobs/notifications/{jobId}/retry

# Resets attempt counter and puts job back in queue
# Use when: Fixed underlying issue, want to retry manually
```

#### Remove Job
```bash
DELETE /api/admin/queue/jobs/notifications/{jobId}

# Permanently removes job from queue
# Use when: No longer needed, corrupted data
```

#### Get Jobs by Status
```bash
GET /api/admin/queue/jobs/notifications/status/failed?limit=100

# Returns jobs with specific status: active|waiting|failed|completed
```

---

## Best Practices

### 1. Choose Appropriate Retry Policies

```typescript
// Critical operations
const criticalJob = await queueService.addNotificationJob(
  data,
  getJobOptionsForPolicy(RetryPolicy.CRITICAL)
);

// Regular emails
const emailJob = await queueService.addEmailJob(
  data,
  getJobOptionsForPolicy(RetryPolicy.NORMAL)
);

// Cleanup tasks
const cleanupJob = await queueService.addCleanupJob(
  data,
  getJobOptionsForPolicy(RetryPolicy.LOW)
);
```

### 2. Implement Idempotent Job Handlers

Jobs may be retried multiple times. Ensure processing is idempotent:

```typescript
@Process()
async processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, message } = job.data;

  // Check if already processed (idempotency key)
  const alreadyProcessed = await this.checkNotificationSent(
    userId,
    type,
    message
  );

  if (alreadyProcessed) {
    this.logger.debug(
      `Notification already sent to ${userId}, skipping`
    );
    return; // Consider it successful
  }

  // Process the job
  await this.sendNotification(job.data);

  // Mark as processed
  await this.markNotificationSent(userId, type, message);
}
```

### 3. Handle Non-Retryable Errors Explicitly

```typescript
@Process()
async processJob(job: Job): Promise<void> {
  try {
    await doWork();
  } catch (error) {
    // Check if we should retry
    if (error instanceof ValidationError) {
      // Non-retryable: go directly to DLQ
      await this.dlqService.addToDLQ(
        job,
        error,
        DLQReason.NON_RETRYABLE_ERROR,
        QueueName.NOTIFICATIONS
      );
      return;
    }

    if (error instanceof ServiceUnavailableError) {
      // Retryable: let Bull handle with backoff
      throw error;
    }

    throw error;
  }
}
```

### 4. Monitor Queue Health Regularly

```typescript
// Set up alerts for unhealthy queues
setInterval(async () => {
  for (const queueName of Object.values(QueueName)) {
    const health = analyticsService.getQueueHealth(queueName);

    if (health.status === 'critical') {
      await notifyAdmins(
        `Critical queue issue: ${queueName}`,
        health.issues
      );
    }
  }
}, 60000); // Check every minute
```

### 5. Set Appropriate Timeouts

```typescript
// Configure timeouts based on job complexity
const options: JobOptions = {
  timeout: 30000,  // 30 seconds for quick jobs
  attempts: 3,
};

// Longer timeout for heavy operations
const reportOptions: JobOptions = {
  timeout: 300000, // 5 minutes for report generation
  attempts: 2,
};
```

### 6. Use Job Progress Tracking

```typescript
@Process()
async processLongRunningJob(job: Job): Promise<void> {
  await job.progress(0);

  // Step 1
  await doStep1();
  await job.progress(25);

  // Step 2
  await doStep2();
  await job.progress(50);

  // Step 3
  await doStep3();
  await job.progress(75);

  // Final step
  await doFinalStep();
  await job.progress(100);
}
```

### 7. Clean Up Old Jobs Regularly

```typescript
// Configure in queue setup
defaultJobOptions: {
  removeOnComplete: {
    age: 24 * 3600,  // Remove after 24 hours
    count: 1000      // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600  // Keep failed jobs for 7 days
  }
}
```

### 8. Implement Rate Limiting

```typescript
// Configure limiter in queue setup
BullModule.registerQueue({
  name: QueueName.EMAILS,
  limiter: {
    max: 50,        // Max 50 jobs
    duration: 1000  // Per 1 second = 50 jobs/sec
  }
})
```

### 9. Log Meaningful Information

```typescript
@OnQueueFailed()
onFailed(job: Job, error: Error): void {
  this.logger.error(
    `Job ${job.id} failed on attempt ${job.attemptsMade}/${job.opts.attempts}`,
    {
      jobId: job.id,
      queueName: job.queue.name,
      error: error.message,
      stack: error.stack,
      data: job.data,
      timestamp: new Date().toISOString(),
    }
  );
}
```

### 10. Use DLQ for Visibility

Always monitor DLQ for patterns:

```typescript
// Daily DLQ analysis
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async analyzeDLQ(): Promise<void> {
  const dlqStats = this.dlqService.getDLQStats();

  // Log summary
  Object.entries(dlqStats).forEach(([queue, stats]) => {
    if (stats.count > 0) {
      this.logger.warn(
        `DLQ Alert: ${stats.count} items in ${queue} DLQ`,
        {
          oldestItem: stats.oldestItem,
        }
      );
    }
  });
}
```

---

## API Reference

### Queue Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/queue/metrics` | Get all queue metrics |
| `GET` | `/api/queue/metrics/:queueName` | Get queue metrics |
| `GET` | `/api/queue/health` | Get system health |
| `GET` | `/api/queue/jobs/:queueName/:jobId` | Get job status |
| `POST` | `/api/queue/jobs/:queueName/:jobId/retry` | Retry job |
| `DELETE` | `/api/queue/jobs/:queueName/:jobId` | Remove job |
| `POST` | `/api/queue/pause/:queueName` | Pause queue |
| `POST` | `/api/queue/resume/:queueName` | Resume queue |
| `DELETE` | `/api/queue/empty/:queueName` | Empty queue |

### Admin Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/queue/dashboard` | Dashboard summary |
| `GET` | `/api/admin/queue/metrics/all` | All queue metrics |
| `GET` | `/api/admin/queue/metrics/:queueName` | Queue metrics |
| `GET` | `/api/admin/queue/metrics/:queueName/history` | Metrics history |
| `POST` | `/api/admin/queue/analytics/report` | Generate report |
| `GET` | `/api/admin/queue/health/all` | All queue health |
| `GET` | `/api/admin/queue/health/:queueName` | Queue health |
| `GET` | `/api/admin/queue/dlq/:queueName` | DLQ items |
| `POST` | `/api/admin/queue/dlq/:queueName/:jobId/recover` | Recover job |
| `DELETE` | `/api/admin/queue/dlq/:queueName/:jobId` | Remove DLQ item |
| `DELETE` | `/api/admin/queue/dlq/:queueName` | Clear DLQ |
| `POST` | `/api/admin/queue/control/:queueName/pause` | Pause queue |
| `POST` | `/api/admin/queue/control/:queueName/resume` | Resume queue |
| `DELETE` | `/api/admin/queue/control/:queueName` | Empty queue |
| `GET` | `/api/admin/queue/system/health` | System health |
| `GET` | `/api/admin/queue/diagnostics` | System diagnostics |

---

## Troubleshooting

### Jobs Keep Failing

1. **Check job data**: Ensure job data is valid and serializable
2. **Review error logs**: Check processor error messages
3. **Verify external services**: Ensure third-party services are available
4. **Increase timeout**: May need longer processing time
5. **Lower concurrency**: Reduce concurrent processing to prevent resource exhaustion

### High DLQ Count

1. **Review DLQ items**: Get oldest items to identify patterns
2. **Fix underlying issue**: Address root cause (API, database, etc.)
3. **Recover jobs**: Use recovery API once issue is fixed
4. **Monitor metrics**: Track failure rate to ensure recovery

### Queue Not Processing

1. **Check queue status**: Is it paused?
2. **Verify Redis connection**: Ensure Redis is available
3. **Review logs**: Check for processor errors
4. **Restart workers**: May need to restart job processors
5. **Check job limits**: Ensure job concurrency is configured

### Memory Issues

1. **Monitor metrics history**: Check for memory leaks
2. **Configure retention**: Set appropriate `removeOnComplete` and `removeOnFail`
3. **Limit queue size**: Use queue limiters
4. **Scale workers**: Distribute processing across multiple instances

---

## Examples

### Complete Job Processing Example

```typescript
import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../queue.constants';
import { RetryPolicy, getJobOptionsForPolicy } from '../queue.config';
import { ExponentialBackoffService } from '../exponential-backoff.service';
import { DeadLetterQueueService, DLQReason } from '../dead-letter-queue.service';

@Processor(QueueName.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private backoffService: ExponentialBackoffService,
    private dlqService: DeadLetterQueueService,
  ) {}

  @Process({ concurrency: 10 })
  async processNotification(job: Job<NotificationJobData>): Promise<void> {
    try {
      await job.progress(10);

      // Validate
      if (!this.validateData(job.data)) {
        throw new ValidationError('Invalid notification data');
      }

      await job.progress(30);

      // Check idempotency
      if (await this.isAlreadySent(job.data)) {
        this.logger.debug(`Notification already sent: ${job.id}`);
        return;
      }

      await job.progress(50);

      // Send notification
      await this.sendToUser(job.data);

      await job.progress(75);

      // Store record
      await this.storeNotification(job.data);

      await job.progress(100);

      this.logger.log(`Notification ${job.id} sent successfully`);
    } catch (error) {
      // Handle non-retryable errors
      if (error instanceof ValidationError) {
        await this.dlqService.addToDLQ(
          job,
          error,
          DLQReason.NON_RETRYABLE_ERROR,
          QueueName.NOTIFICATIONS
        );
        return;
      }

      // Let Bull handle retry
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
      await this.dlqService.addToDLQ(
        job,
        error,
        DLQReason.MAX_RETRIES_EXCEEDED,
        QueueName.NOTIFICATIONS
      );
    }

    this.logger.error(
      `Notification job ${job.id} failed: ${error.message}`,
      {
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        nextRetry: backoffResult.nextRetryTime,
      }
    );
  }

  private validateData(data: NotificationJobData): boolean {
    return !!(data.userId && data.type && data.message);
  }

  private async isAlreadySent(data: NotificationJobData): Promise<boolean> {
    // Check your database/cache
    return false;
  }

  private async sendToUser(data: NotificationJobData): Promise<void> {
    // Send via WebSocket, email, SMS, etc.
  }

  private async storeNotification(data: NotificationJobData): Promise<void> {
    // Store in database
  }
}
```

---

## Version History

- **v1.0.0** (2024-01-31): Initial release with exponential backoff, DLQ, analytics, and admin dashboard

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review queue logs and metrics
3. Check DLQ for failed jobs
4. Contact your system administrator
