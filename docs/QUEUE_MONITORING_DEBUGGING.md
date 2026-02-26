# Bull Queue System - Monitoring & Debugging Guide

## Real-Time Queue Monitoring

### Dashboard Monitoring

The admin dashboard provides real-time visibility into queue operations:

```bash
# Get complete dashboard snapshot
curl -X GET http://localhost:3000/api/admin/queue/dashboard

# Response includes:
# - Real-time job counts per queue
# - DLQ statistics
# - Health status for each queue
# - Active jobs and wait times
```

### Health Status Monitoring

Monitor queue health at different intervals:

```typescript
// Quick health check (every 30 seconds)
setInterval(async () => {
  const health = await analyticsService.getQueueHealth('notifications');
  
  if (health.status !== 'healthy') {
    console.warn('Queue health degraded:', health.issues);
  }
}, 30000);

// Detailed diagnostic (every hour)
@Cron(CronExpression.EVERY_HOUR)
async hourlyDiagnostics() {
  const metrics = await queueService.getAllQueueMetrics();
  const health = {};
  
  for (const queue of Object.values(QueueName)) {
    health[queue] = analyticsService.getQueueHealth(queue);
  }
  
  console.log('Hourly Diagnostics:', { metrics, health });
}
```

## Metrics Collection

### Key Metrics to Track

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Active Jobs | < 100 | 100-500 | > 500 |
| Waiting Jobs | < 1,000 | 1,000-5,000 | > 5,000 |
| Success Rate | > 99% | 95-99% | < 95% |
| Failure Rate | < 1% | 1-5% | > 5% |
| Avg Processing Time | < 1s | 1-5s | > 5s |
| DLQ Items | 0-10 | 10-50 | > 50 |

### Collecting Metrics Periodically

```typescript
@Injectable()
export class MetricsCollectorService {
  constructor(
    private analyticsService: QueueAnalyticsService,
    private logger: Logger,
  ) {
    this.startCollection();
  }

  private startCollection(): void {
    // Collect metrics every minute
    setInterval(() => this.collectMetrics(), 60000);
  }

  private async collectMetrics(): Promise<void> {
    const now = new Date();

    for (const queueName of Object.values(QueueName)) {
      const queue = this.getQueueByName(queueName);
      const metrics = await this.analyticsService.getCurrentMetrics(queue);
      
      // Store in time-series database
      this.recordMetrics(metrics);

      // Log summary
      this.logger.log(
        `[${now.toISOString()}] ${queueName}: ` +
        `active=${metrics.activeJobs}, ` +
        `waiting=${metrics.waitingJobs}, ` +
        `success=${metrics.successRate}%`
      );
    }
  }

  private recordMetrics(metrics: QueueMetricsSnapshot): void {
    // Send to monitoring system (Prometheus, InfluxDB, etc.)
    // This is an example - adapt to your system
    this.analyticsService.recordMetrics(metrics);
  }

  private getQueueByName(name: string): Queue {
    // Get queue instance
  }
}
```

## Debugging Failed Jobs

### Identify Failed Jobs

```bash
# Get failed jobs from a queue
GET /api/admin/queue/jobs/notifications/status/failed?limit=10

# Response contains:
# - Job ID
# - Error message
# - When it failed
# - Number of attempts
```

### Inspect Job Details

```bash
# Get detailed job information
GET /api/admin/queue/jobs/notifications/{jobId}

# Response:
{
  "id": "12345",
  "status": "failed",
  "data": {
    "userId": "user-123",
    "type": "trade_completed",
    "message": "..."
  },
  "error": "Connection timeout",
  "stack": "Error: Connection timeout\n    at...",
  "attempts": 3,
  "maxAttempts": 3,
  "createdAt": "2024-01-31T10:00:00Z",
  "finishedOn": "2024-01-31T10:05:00Z",
  "failedReason": "MAX_RETRIES_EXCEEDED"
}
```

### Common Error Patterns

```typescript
// Pattern recognition helper
function analyzeFailurePattern(dlqItems: DLQItem[]): Map<string, number> {
  const errorCounts = new Map<string, number>();

  dlqItems.forEach(item => {
    // Extract error type (first line of error message)
    const errorType = item.error.split(':')[0];
    errorCounts.set(
      errorType,
      (errorCounts.get(errorType) || 0) + 1
    );
  });

  return errorCounts;
}

// Usage
const dlqItems = dlqService.getDLQItems('notifications', 100);
const patterns = analyzeFailurePattern(dlqItems);

// Print top 5 error types
patterns
  .entries()
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([error, count]) => {
    console.log(`${error}: ${count} occurrences`);
  });
```

## Performance Analysis

### Throughput Analysis

```typescript
// Calculate jobs processed per minute
function calculateThroughput(
  startTime: Date,
  endTime: Date,
  queueName: string,
): number {
  const history = analyticsService.getMetricsHistory(queueName);
  
  const filtered = history.filter(
    m => m.timestamp >= startTime && m.timestamp <= endTime
  );

  if (filtered.length === 0) return 0;

  const firstSnapshot = filtered[0];
  const lastSnapshot = filtered[filtered.length - 1];

  const jobsProcessed =
    lastSnapshot.completedJobs - firstSnapshot.completedJobs;
  const durationMinutes =
    (lastSnapshot.timestamp.getTime() - firstSnapshot.timestamp.getTime()) /
    (60 * 1000);

  return jobsProcessed / durationMinutes;
}
```

### Latency Analysis

```typescript
// Analyze processing time trends
function analyzeLatencyTrend(
  queueName: string,
  windowMinutes: number = 60,
): { current: number; average: number; trend: string } {
  const history = analyticsService.getMetricsHistory(queueName);
  
  const recentCutoff = Date.now() - windowMinutes * 60 * 1000;
  const recent = history.filter(m => m.timestamp.getTime() > recentCutoff);

  if (recent.length < 2) {
    return { current: 0, average: 0, trend: 'insufficient data' };
  }

  const current = recent[recent.length - 1].averageProcessingTime;
  const average =
    recent.reduce((sum, m) => sum + m.averageProcessingTime, 0) /
    recent.length;

  const trend =
    current > average ? 'increasing' : current < average ? 'decreasing' : 'stable';

  return { current, average, trend };
}
```

## Alert Rules

### Set Up Alert Thresholds

```typescript
@Injectable()
export class AlertingService {
  constructor(
    private analyticsService: QueueAnalyticsService,
    private notificationService: NotificationService,
  ) {
    this.startAlertMonitoring();
  }

  private startAlertMonitoring(): void {
    setInterval(() => this.checkAlerts(), 60000);
  }

  private async checkAlerts(): Promise<void> {
    for (const queueName of Object.values(QueueName)) {
      const health = this.analyticsService.getQueueHealth(queueName);

      // Alert on critical
      if (health.status === 'critical') {
        await this.sendAlert({
          level: 'critical',
          queue: queueName,
          issues: health.issues,
          timestamp: new Date(),
        });
      }

      // Alert on repeated warnings
      if (health.status === 'warning') {
        const recentWarnings = this.getRecentWarnings(queueName);
        if (recentWarnings > 3) {
          await this.sendAlert({
            level: 'warning',
            queue: queueName,
            issues: health.issues,
            timestamp: new Date(),
          });
        }
      }
    }

    // Check DLQ threshold
    const dlqStats = this.dlqService.getDLQStats();
    for (const [queue, stats] of Object.entries(dlqStats)) {
      if (stats.count > 100) {
        await this.sendAlert({
          level: 'warning',
          queue: queue as string,
          issues: [`DLQ has ${stats.count} items, consider review`],
          timestamp: new Date(),
        });
      }
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Send via email, Slack, PagerDuty, etc.
    await this.notificationService.sendAlert(alert);
  }

  private getRecentWarnings(queueName: string): number {
    // Count warnings in last hour
    const recentAlerts = this.analyticsService.getQueueHealth(queueName);
    return recentAlerts.issues.length;
  }
}
```

## Log Analysis

### Structured Logging Setup

```typescript
// Example structured log
this.logger.error('Job processing failed', {
  jobId: job.id,
  queueName: job.queue.name,
  error: error.message,
  stack: error.stack,
  data: {
    userId: job.data.userId,
    type: job.data.type,
  },
  metadata: {
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    processingTime: Date.now() - job.processedOn,
    timestamp: new Date().toISOString(),
  },
});
```

### Parse and Analyze Logs

```typescript
// Query error logs
function findErrorPattern(logLines: string[]): Map<string, number> {
  const errorPattern = /error.*:\s*(.+)/i;
  const matches = new Map<string, number>();

  logLines.forEach(line => {
    const match = line.match(errorPattern);
    if (match) {
      const error = match[1];
      matches.set(error, (matches.get(error) || 0) + 1);
    }
  });

  return matches;
}

// Find frequency of specific error
function findErrorFrequency(
  logLines: string[],
  errorPattern: string,
): number {
  return logLines.filter(line => line.includes(errorPattern)).length;
}
```

## Performance Tuning

### Identify Bottlenecks

```typescript
// Find slowest jobs
function findSlowJobs(queueName: string, limit: number = 10): Job[] {
  const history = analyticsService.getMetricsHistory(queueName);
  
  // Average processing time indicates queue slowness
  const slowestSnapshots = history
    .sort((a, b) => b.averageProcessingTime - a.averageProcessingTime)
    .slice(0, limit);

  return slowestSnapshots;
}

// Find periods of high queue buildup
function findQueueBackups(queueName: string): Date[] {
  const history = analyticsService.getMetricsHistory(queueName);
  
  return history
    .filter(m => m.waitingJobs > 1000)
    .map(m => m.timestamp);
}
```

### Optimize Configuration

```typescript
// Recommendations based on metrics
function getOptimizationRecommendations(queueName: string): string[] {
  const recommendations = [];
  const health = analyticsService.getQueueHealth(queueName);
  const history = analyticsService.getMetricsHistory(queueName, 100);

  if (history.length === 0) {
    return ['Insufficient data for recommendations'];
  }

  const latest = history[history.length - 1];

  // Concurrency recommendations
  if (latest.activeJobs < 5) {
    recommendations.push('Consider increasing concurrency');
  } else if (latest.activeJobs > 100) {
    recommendations.push('Consider decreasing concurrency or scaling workers');
  }

  // Timeout recommendations
  if (latest.averageProcessingTime > 30000) {
    recommendations.push('Consider increasing job timeout');
  }

  // Retry recommendations
  if (latest.failureRate > 10) {
    recommendations.push('High failure rate - investigate root cause');
  } else if (latest.failureRate === 0) {
    recommendations.push('Consider reducing retry attempts to improve performance');
  }

  return recommendations;
}
```

## Incident Response

### Emergency Queue Management

```typescript
// During outage: Pause queue to prevent data loss
async function pauseQueueForMaintenance(queueName: QueueName): Promise<void> {
  await queueService.pauseQueue(queueName);
  await notificationService.alertAdmins(
    `Queue ${queueName} paused for maintenance`
  );
}

// Drain queue before scaling
async function drainQueueBefore Scaling(queueName: QueueName): Promise<void> {
  await queueService.waitUntilEmpty(queueName);
  // Now safe to scale down workers
}

// Recover after incident
async function recoverAfterIncident(queueName: QueueName): Promise<void> {
  // Check DLQ
  const dlqStats = dlqService.getDLQStats();
  console.log(`DLQ contains ${dlqStats[queueName].count} items`);

  // Recover high-priority items
  const dlqItems = dlqService.getDLQItems(queueName);
  const criticalItems = dlqItems.filter(
    item => item.metadata?.priority === 'high'
  );

  for (const item of criticalItems) {
    await dlqService.recoverJob(queueName, item.jobId);
  }

  // Resume processing
  await queueService.resumeQueue(queueName);
}
```

## Monitoring Dashboard Endpoints

### For Grafana/DataDog Integration

```bash
# Export metrics in Prometheus format
GET /api/admin/queue/metrics/all

# Get time-series data
GET /api/admin/queue/metrics/:queueName/history?limit=1440

# Get system health
GET /api/admin/queue/system/health

# Generate reports
POST /api/admin/queue/analytics/report
```

### Example Grafana Queries

```json
// Waiting jobs by queue
{
  "expr": "queue_waiting_jobs{queue=\"$queue\"}"
}

// Success rate trend
{
  "expr": "rate(queue_success_total[5m])"
}

// Error rate trend
{
  "expr": "rate(queue_errors_total[5m])"
}
```

## Health Check Integration

```typescript
// Add to your health check endpoint
@Get('health')
@HealthCheck()
async getHealth() {
  const queueHealth = {};

  for (const queueName of Object.values(QueueName)) {
    const health = analyticsService.getQueueHealth(queueName);
    queueHealth[queueName] = {
      status: health.status === 'healthy' ? 'up' : 'down',
      issues: health.issues,
    };
  }

  const allHealthy = Object.values(queueHealth).every(
    (h: any) => h.status === 'up'
  );

  return {
    status: allHealthy ? 'ok' : 'degraded',
    queues: queueHealth,
    timestamp: new Date().toISOString(),
  };
}
```

## Troubleshooting Checklist

- [ ] Check queue pause status
- [ ] Verify Redis connection
- [ ] Review recent error logs
- [ ] Check DLQ for patterns
- [ ] Verify processor deployments
- [ ] Check system resources (CPU, memory)
- [ ] Review recent deployments
- [ ] Check external service status
- [ ] Verify job configuration
- [ ] Check authentication/authorization
