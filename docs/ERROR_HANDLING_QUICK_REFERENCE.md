# Error Handling System - Quick Reference

## Imports

```typescript
import { CircuitBreakerService } from '@/common/services/circuit-breaker.service';
import { RetryService } from '@/common/services/retry.service';
import { BulkheadService } from '@/common/services/bulkhead.service';
import { DeadLetterQueueService } from '@/common/services/dead-letter-queue.service';
import { SagaService, SagaStep } from '@/common/services/saga.service';
import { CorrelationIdService } from '@/common/services/correlation-id.service';
import { ErrorMonitoringService } from '@/common/services/error-monitoring.service';
import { ErrorCategorizer } from '@/common/exceptions/error-categorizer';
```

## Circuit Breaker

### Register

```typescript
circuitBreakerService.register(async () => apiCall(), {
  name: 'api-name',
  timeout: 5000,
  errorThresholdPercentage: 50,
  volumeThreshold: 10,
  fallback: () => cachedData,
});
```

### Execute

```typescript
const result = await circuitBreakerService.execute(
  'api-name',
  () => apiCall(params),
  params,
);
```

### Monitor

```typescript
const state = circuitBreakerService.getState('api-name'); // CLOSED | OPEN | HALF_OPEN
const metrics = circuitBreakerService.getMetrics('api-name');
circuitBreakerService.reset('api-name');
```

## Retry

### Execute with Retry

```typescript
// Using predefined policy
const result = await retryService.executeWithRetry(
  () => operation(),
  'moderate', // 'aggressive' | 'moderate' | 'conservative'
  'operationName',
);

if (result.success) {
  console.log(result.result);
} else {
  throw result.error;
}
```

### Custom Policy

```typescript
const policy = retryService.createCustomPolicy(
  maxRetries: 5,
  initialDelayMs: 200,
  maxDelayMs: 15000,
  multiplier: 2.5,
  jitterFactor: 0.15,
);

const result = await retryService.retryWithPolicy(
  () => operation(),
  policy,
  'operationName',
);
```

## Bulkhead

### Create

```typescript
bulkheadService.createBulkhead({
  name: 'resource-name',
  maxConcurrent: 10,
  timeout: 30000,
});
```

### Execute

```typescript
const result = await bulkheadService.execute(
  'resource-name',
  () => operation(),
  'operationName',
);
```

### Monitor

```typescript
const metrics = bulkheadService.getMetrics('resource-name');
// { maxConcurrent, currentConcurrent, queuedRequests, totalRequests, ... }
```

## Dead Letter Queue

### Register

```typescript
deadLetterQueueService.registerDLQ('queue-name', {
  maxRetries: 3,
  retentionDays: 7,
  notifyOnThreshold: 50,
});
```

### Send to DLQ

```typescript
await deadLetterQueueService.sendToDLQ(
  'queue-name',
  jobId,
  'functionName',
  jobData,
  error,
  attemptCount,
  metadata,
);
```

### Retrieve and Manage

```typescript
const messages = deadLetterQueueService.getDLQMessages('queue-name', limit);
const stats = deadLetterQueueService.getDLQStats();
deadLetterQueueService.clearDLQ('queue-name');
```

### Subscribe

```typescript
deadLetterQueueService.onDLQMessage('queue-name', (message) => {
  console.log('DLQ message:', message);
});
```

## Saga

### Execute Sequential

```typescript
const steps: SagaStep[] = [
  {
    name: 'step1',
    action: () => operation1(),
    compensation: (result) => rollback1(result),
  },
  {
    name: 'step2',
    action: () => operation2(),
    compensation: (result) => rollback2(result),
  },
];

const result = await sagaService.executeSaga('saga-name', steps);

if (result.success) {
  // All steps completed
} else {
  // Failed at: result.failedStep
  // Compensated: result.compensatedSteps
}
```

### Execute Parallel

```typescript
const result = await sagaService.executeParallelSteps('saga-name', steps);
```

## Correlation ID

### Get Current

```typescript
const correlationId = correlationIdService.getCorrelationId();
const traceId = correlationIdService.getTraceId();
const requestId = correlationIdService.getRequestId();
const userId = correlationIdService.getUserId();
```

### Get Headers

```typescript
const headers = correlationIdService.getContextHeaders();
// { 'x-correlation-id': '...', 'x-trace-id': '...', ... }
```

### Add to External Calls

```typescript
const headers = correlationIdService.getContextHeaders();
const response = await fetch(url, {
  headers: { ...headers, ...otherHeaders },
});
```

## Error Monitoring

### Record Error

```typescript
errorMonitoringService.recordError(error, {
  correlationId,
  userId,
  endpoint: '/api/endpoint',
  severity: 'MEDIUM',
});
```

### Get Metrics

```typescript
const metrics = errorMonitoringService.getMetrics();
// {
//   totalErrors,
//   errorsByCategory,
//   errorsBySeverity,
//   errorsByCode,
//   topErrors,
//   recentErrors,
//   ...
// }
```

### Query Errors

```typescript
errorMonitoringService.getErrorsByCategory('TRANSIENT');
errorMonitoringService.getErrorsBySeverity('HIGH');
errorMonitoringService.getErrorsByCode('CODE');
errorMonitoringService.getErrorsByUser('user-id');
errorMonitoringService.getErrorsByTimeRange(start, end);
```

## Error Categorizer

### Check Error

```typescript
const errorInfo = ErrorCategorizer.categorize(error);
// {
//   category: 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN',
//   severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
//   errorType: 'NETWORK' | 'TIMEOUT' | 'RATE_LIMIT' | ...,
//   retryable: boolean,
//   maxRetries: number,
//   ...
// }
```

### Quick Checks

```typescript
ErrorCategorizer.isRetryable(error);
ErrorCategorizer.isCircuitBreakerCompatible(error);
ErrorCategorizer.getMaxRetries(error);
ErrorCategorizer.getBackoffMultiplier(error);
```

## Common Patterns

### Protected API Call

```typescript
async function callAPI(url: string) {
  const result = await retryService.executeWithRetry(
    async () => {
      return circuitBreakerService.execute(
        'api-call',
        async () => fetch(url).then(r => r.json()),
      );
    },
    'moderate',
  );

  if (!result.success) throw result.error;
  return result.result;
}
```

### Protected Database Operation

```typescript
async function queryDatabase(query: string) {
  const result = await bulkheadService.execute(
    'database',
    async () => {
      return retryService.executeWithRetry(
        () => db.query(query),
        'moderate',
      );
    },
    'queryDatabase',
  );

  if (result.success) return result.result;
  throw result.error;
}
```

### Protected Async Job

```typescript
async function processJob(jobData: any) {
  try {
    const result = await bulkheadService.execute(
      'job-processor',
      () => actualJobProcessing(jobData),
      'processJob',
    );
    return result;
  } catch (error) {
    await deadLetterQueueService.sendToDLQ(
      'jobs',
      jobData.id,
      'processJob',
      jobData,
      error,
      1,
    );
    throw error;
  }
}
```

## Dashboard Endpoints

```
GET  /api/dashboard/summary              - Overview
GET  /api/dashboard/errors/metrics       - Error details
GET  /api/dashboard/errors/stats         - Statistics
GET  /api/dashboard/errors/recent        - Recent errors
GET  /api/dashboard/errors/critical      - Critical errors
GET  /api/dashboard/circuit-breakers     - CB status
GET  /api/dashboard/circuit-breakers/:name
POST /api/dashboard/circuit-breakers/:name/reset
GET  /api/dashboard/bulkheads            - Bulkhead status
GET  /api/dashboard/dlq/stats            - DLQ status
GET  /api/dashboard/dlq/:queueName       - DLQ messages
GET  /api/dashboard/health               - Health check
```

## Logging with Context

```typescript
// With correlation ID (automatically via middleware)
this.logger.log(`[${correlationId}] Operation started`);
this.logger.warn(`[${correlationId}] Warning message`);
this.logger.error(`[${correlationId}] Error message`);

// From anywhere
const correlationId = this.correlationIdService.getCorrelationId();
this.logger.log(`[${correlationId}] Message`);
```

## Error Handling Checklist

- [ ] External API calls use circuit breaker + retry
- [ ] Long operations use bulkhead pattern
- [ ] Failed jobs are sent to DLQ
- [ ] Complex transactions use saga pattern
- [ ] All errors are monitored
- [ ] Correlation IDs logged with each message
- [ ] Dashboard monitored for health
- [ ] DLQ messages reviewed regularly
- [ ] Circuit breakers reset when services recover
- [ ] Tests cover error scenarios

## Performance Notes

- Circuit breaker timeout: 3-5s for APIs, 10-30s for databases
- Retry policies: aggressive for transient, conservative for critical
- Bulkhead limits: 10-20 for APIs, 2-5 for databases
- DLQ retention: 7-14 days for transient, 30+ days for critical
- Error events in memory: max 10,000 (auto-cleanup)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Circuit breaker always open | Check service health, review errors, reset breaker |
| DLQ filling up | Investigate error cause, fix root issue, retry messages |
| High error rate | Check dependencies, monitor circuit breakers, review logs |
| Retries not working | Check error categorization, ensure it's transient |
| Missing correlation IDs | Verify middleware is registered, check log format |
| Bulkhead timeout | Increase timeout or reduce concurrency limit |

## Examples

See `docs/ERROR_HANDLING_GUIDE.md` and `src/common/examples/error-handling-examples.ts` for complete examples.
