# Bull Queue System - Quick Reference

## Quick Start

### Adding Jobs with Retries

```typescript
import { QueueService } from './queue/queue.service';
import { RetryPolicy, getJobOptionsForPolicy } from './queue/queue.config';

constructor(private queueService: QueueService) {}

// Simple notification
await this.queueService.addNotificationJob({
  userId: '123',
  type: 'trade_completed',
  title: 'Trade Complete',
  message: 'Your trade has completed successfully'
});

// With retry policy
await this.queueService.addNotificationJob(
  {
    userId: '123',
    type: 'trade_completed',
    title: 'Trade Complete',
    message: 'Your trade has completed successfully'
  },
  getJobOptionsForPolicy(RetryPolicy.CRITICAL)
);

// With custom options
await this.queueService.addEmailJob(
  emailData,
  {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    priority: 1,
    delay: 5000, // Start in 5 seconds
  }
);
```

## Retry Policies at a Glance

| Policy | Attempts | Base Delay | Max Delay | Best For |
|--------|----------|-----------|-----------|----------|
| **CRITICAL** | 5 | 1s | 60s | Payments, critical trades |
| **HIGH** | 4 | 2s | 45s | Trade notifications |
| **NORMAL** | 3 | 5s | 30s | Regular emails, standard jobs |
| **LOW** | 1 | 10s | 10s | Cleanup, logging |

## DLQ Quick Commands

```bash
# View DLQ items
GET /api/admin/queue/dlq/notifications?limit=50

# Recover a failed job
POST /api/admin/queue/dlq/notifications/{jobId}/recover

# Remove DLQ item
DELETE /api/admin/queue/dlq/notifications/{jobId}

# Clear entire DLQ
DELETE /api/admin/queue/dlq/notifications

# View DLQ stats
GET /api/admin/queue/dlq-stats
```

## Monitoring Quick Commands

```bash
# Dashboard overview
GET /api/admin/queue/dashboard

# Queue health for all queues
GET /api/admin/queue/health/all

# Queue health for specific queue
GET /api/admin/queue/health/notifications

# Metrics history (last 100)
GET /api/admin/queue/metrics/notifications/history

# System diagnostics
GET /api/admin/queue/diagnostics
```

## Queue Control Quick Commands

```bash
# Pause queue
POST /api/admin/queue/control/notifications/pause

# Resume queue
POST /api/admin/queue/control/notifications/resume

# Empty queue
DELETE /api/admin/queue/control/notifications

# Drain queue (process and complete)
POST /api/admin/queue/control/notifications/drain
```

## Retry Policy Selection Guide

**Choose CRITICAL if:**
- Payment processing
- Trade confirmations
- System-critical operations
- Data loss consequences

**Choose HIGH if:**
- Important notifications
- Order/trade updates
- Revenue-impacting operations

**Choose NORMAL if:**
- Regular emails
- Standard notifications
- Most background jobs

**Choose LOW if:**
- Cleanup operations
- Logging/analytics
- Non-critical background work

## Exponential Backoff Example

For NORMAL policy (baseDelay: 5s, multiplier: 1.5):

```
Attempt 1: Job fails
  ↓
5s delay
  ↓
Attempt 2: Job fails
  ↓
7.5s delay (5 × 1.5)
  ↓
Attempt 3: Job fails
  ↓
Permanently failed → DLQ
```

## Common Errors

### Job keeps failing in DLQ

**Solution:**
1. Review DLQ item error message
2. Fix underlying issue
3. Use recovery API: `POST /api/admin/queue/dlq/:queue/:jobId/recover`

### Queue not processing

**Solution:**
1. Check if paused: `GET /api/admin/queue/health/:queueName`
2. Verify Redis connection
3. Check job processor logs
4. Resume if paused: `POST /api/admin/queue/control/:queue/resume`

### High memory usage

**Solution:**
1. Configure job retention:
```typescript
removeOnComplete: { age: 24 * 3600, count: 1000 }
removeOnFail: { age: 7 * 24 * 3600 }
```
2. Use queue limiters
3. Reduce job concurrency

## Health Status Indicators

🟢 **Healthy**: No issues, all metrics within thresholds
🟡 **Warning**: Metrics approaching limits, monitor closely
🔴 **Critical**: Action required immediately

## Idempotent Job Example

```typescript
@Process()
async processJob(job: Job): Promise<void> {
  const key = `${job.id}:${job.data.userId}:${job.data.type}`;
  
  // Check if already processed
  const processed = await redis.get(key);
  if (processed) {
    return; // Already done
  }

  // Do work
  await doWork(job.data);

  // Mark as processed
  await redis.set(key, '1', 'EX', 86400); // Expire in 24h
}
```

## Recommended Monitoring Setup

```typescript
// Check queue health every minute
setInterval(async () => {
  const health = analyticsService.getQueueHealth('notifications');
  
  if (health.status === 'critical') {
    alertAdmins(`Critical issue in notifications queue: ${health.issues}`);
  }
}, 60000);

// Monitor DLQ daily
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async monitorDLQ() {
  const stats = dlqService.getDLQStats();
  Object.entries(stats).forEach(([queue, stat]) => {
    if (stat.count > 0) {
      console.log(`${queue} DLQ: ${stat.count} items`);
    }
  });
}
```

## API Response Examples

### Get Dashboard
```json
{
  "timestamp": "2024-01-31T10:30:00Z",
  "queues": {
    "notifications": {
      "active": 15,
      "waiting": 245,
      "completedJobs": 15342,
      "failedJobs": 12,
      "successRate": 99.92
    }
  },
  "dlq": {
    "notifications": {
      "count": 5,
      "oldestItem": {
        "jobId": "123",
        "failedAt": "2024-01-31T09:15:00Z",
        "error": "Connection timeout"
      }
    }
  },
  "health": {
    "notifications": {
      "status": "healthy",
      "issues": []
    }
  }
}
```

### Get Queue Health
```json
{
  "status": "warning",
  "issues": [
    "Warning: 1,245 waiting jobs exceeds threshold of 1,000"
  ],
  "thresholds": {
    "warningWaitingCount": 1000,
    "criticalWaitingCount": 5000,
    "warningFailureRate": 5,
    "criticalFailureRate": 10,
    "maxProcessingTimeMs": 300000
  }
}
```

## Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

## Queue Names

```typescript
enum QueueName {
  NOTIFICATIONS = 'notifications',
  EMAILS = 'emails',
  REPORTS = 'reports',
  CLEANUP = 'cleanup',
}
```

## Testing Jobs

```bash
# Queue a test notification
POST /api/queue/test/notification
{
  "userId": "test-user",
  "message": "Test message"
}

# Queue a test email
POST /api/queue/test/email
{
  "to": "test@example.com",
  "subject": "Test Email"
}
```
