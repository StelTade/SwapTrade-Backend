# Production-Grade Error Handling System

## Overview

This document describes the comprehensive error handling system implemented for SwapTrade-Backend. The system includes circuit breakers, exponential backoff retry logic, dead letter queues, correlation ID propagation, bulkhead pattern, saga pattern for distributed transactions, and error monitoring with dashboards.

## Architecture

### Components

1. **Correlation ID Service** - Manages correlation IDs across distributed requests
2. **Circuit Breaker Service** - Uses Opossum to prevent cascading failures
3. **Retry Service** - Implements exponential backoff with jitter for transient errors
4. **Bulkhead Service** - Isolates failures using concurrency limits
5. **Dead Letter Queue Service** - Manages failed job routing and recovery
6. **Saga Service** - Handles distributed transactions with automatic rollback
7. **Error Monitoring Service** - Tracks and analyzes error patterns
8. **Error Dashboard Controller** - REST API for monitoring system health

## Quick Start

### 1. Setting Up the Error Handling Module

```typescript
// app.module.ts
import { ErrorHandlingModule } from './common/error-handling.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [ErrorHandlingModule],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
```

### 2. Using Circuit Breaker

Circuit breakers protect against cascading failures by stopping requests to failing services.

```typescript
import { CircuitBreakerService } from './common/services/circuit-breaker.service';

@Injectable()
export class ExternalServiceClient {
  private externalApiCall: (params: any) => Promise<any>;

  constructor(private circuitBreakerService: CircuitBreakerService) {
    // Register circuit breaker for external API
    this.externalApiCall = this.circuitBreakerService.register(
      this.callExternalAPI.bind(this),
      {
        name: 'external-api',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 10,
        fallback: () => ({ cached: true, data: [] }),
      },
    );
  }

  async callExternalAPI(params: any): Promise<any> {
    // Actual external API call
    const response = await fetch('https://external-api.com/data', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.json();
  }

  async getData(params: any): Promise<any> {
    // Use through circuit breaker
    return this.circuitBreakerService.execute(
      'external-api',
      () => this.externalApiCall(params),
      params,
    );
  }
}
```

### 3. Using Retry Service

Automatically retry failed operations with exponential backoff.

```typescript
import { RetryService } from './common/services/retry.service';

@Injectable()
export class DatabaseService {
  constructor(private retryService: RetryService) {}

  async executeQuery(query: string): Promise<any> {
    const result = await this.retryService.executeWithRetry(
      () => this.performDatabaseQuery(query),
      'moderate', // Policy: 'aggressive', 'moderate', or 'conservative'
      'executeQuery',
    );

    if (!result.success) {
      throw result.lastError;
    }

    return result.result;
  }

  private async performDatabaseQuery(query: string): Promise<any> {
    // Database query logic
  }
}
```

### 4. Using Bulkhead Pattern

Isolate failures by limiting concurrent requests to resources.

```typescript
import { BulkheadService } from './common/services/bulkhead.service';

@Injectable()
export class UserService {
  constructor(private bulkheadService: BulkheadService) {
    // Create bulkhead with max 10 concurrent requests
    this.bulkheadService.createBulkhead({
      name: 'user-service-db',
      maxConcurrent: 10,
    });
  }

  async getUser(userId: string): Promise<User> {
    return this.bulkheadService.execute(
      'user-service-db',
      () => this.fetchUserFromDatabase(userId),
      'getUser',
    );
  }

  private async fetchUserFromDatabase(userId: string): Promise<User> {
    // Database fetch logic
  }
}
```

### 5. Using Dead Letter Queue

Handle permanent failures by routing them to a dead letter queue.

```typescript
import { DeadLetterQueueService } from './common/services/dead-letter-queue.service';

@Injectable()
export class QueueProcessorService {
  constructor(private dlqService: DeadLetterQueueService) {
    // Register DLQ for notifications queue
    this.dlqService.registerDLQ('notifications', {
      maxRetries: 3,
      retentionDays: 7,
      notifyOnThreshold: 100,
    });

    // Subscribe to DLQ messages
    this.dlqService.onDLQMessage(
      'notifications',
      (msg) => {
        this.logger.error(`Message in DLQ: ${msg.functionName}`, msg);
      },
    );
  }

  async processNotification(jobId: string, data: any): Promise<void> {
    try {
      await this.sendNotification(data);
    } catch (error) {
      // Send to DLQ
      await this.dlqService.sendToDLQ(
        'notifications',
        jobId,
        'processNotification',
        data,
        error,
        3,
      );
    }
  }

  private async sendNotification(data: any): Promise<void> {
    // Notification sending logic
  }
}
```

### 6. Using Saga Pattern

Handle complex distributed transactions with automatic rollback.

```typescript
import { SagaService, SagaStep } from './common/services/saga.service';

@Injectable()
export class SwapService {
  constructor(private sagaService: SagaService) {}

  async executeSwap(swapData: any): Promise<void> {
    const steps: SagaStep[] = [
      {
        name: 'lockFunds',
        action: () => this.lockUserFunds(swapData.userId, swapData.amount),
        compensation: (lockId) => this.unlockFunds(lockId),
      },
      {
        name: 'callExternalSwap',
        action: () => this.callExternalSwapAPI(swapData),
        compensation: () => this.reverseSwap(swapData.swapId),
      },
      {
        name: 'updateBalance',
        action: () => this.updateUserBalance(swapData),
        compensation: () => this.revertBalance(swapData.userId),
      },
    ];

    const result = await this.sagaService.executeSaga('TOKEN_SWAP', steps);

    if (!result.success) {
      throw new Error(`Swap failed: ${result.failedStep}`);
    }
  }

  private async lockUserFunds(userId: string, amount: number): Promise<string> {
    // Lock funds and return lock ID
  }

  private async unlockFunds(lockId: string): Promise<void> {
    // Unlock funds
  }

  // ...other methods
}
```

### 7. Using Correlation IDs

Access correlation IDs for request tracking.

```typescript
import { CorrelationIdService } from './common/services/correlation-id.service';

@Injectable()
export class LoggingService {
  constructor(private correlationIdService: CorrelationIdService) {}

  log(message: string): void {
    const correlationId = this.correlationIdService.getCorrelationId();
    const traceId = this.correlationIdService.getTraceId();

    console.log(`[${correlationId}] [${traceId}] ${message}`);
  }

  // Log with correlation context automatically included
}
```

### 8. Monitoring with Error Dashboard

Access the error dashboard at: `http://localhost:3000/api/dashboard/summary`

```typescript
// Available endpoints:
GET /api/dashboard/errors/metrics       // Error metrics and trends
GET /api/dashboard/errors/stats         // Error statistics
GET /api/dashboard/errors/recent        // Recent errors
GET /api/dashboard/errors/critical      // Critical errors
GET /api/dashboard/circuit-breakers     // Circuit breaker status
GET /api/dashboard/circuit-breakers/:name // Specific circuit breaker
POST /api/dashboard/circuit-breakers/:name/reset // Reset circuit breaker
GET /api/dashboard/bulkheads            // Bulkhead status
GET /api/dashboard/dlq/stats            // DLQ statistics
GET /api/dashboard/dlq/:queueName       // DLQ messages
GET /api/dashboard/health               // System health
GET /api/dashboard/summary              // Dashboard summary
```

## Error Classification

Errors are automatically categorized into:

### Categories
- **TRANSIENT** - Errors that can be retried (network timeouts, service unavailable)
- **PERMANENT** - Errors that cannot be retried (validation errors, authentication)
- **UNKNOWN** - Errors that cannot be categorized

### Types
- NETWORK - Connection errors
- TIMEOUT - Operation timeouts
- RATE_LIMIT - Rate limiting
- SERVICE_UNAVAILABLE - Service is down
- INVALID_INPUT - Invalid parameters
- AUTHENTICATION - Auth failures
- AUTHORIZATION - Permission errors
- NOT_FOUND - Resource not found
- DATABASE - Database errors
- EXTERNAL_SERVICE - External service errors
- INTERNAL - Internal errors

## Retry Policies

### Pre-defined Policies

1. **Aggressive** (5 retries)
   - Initial delay: 100ms
   - Max delay: 10s
   - Backoff multiplier: 2x
   - Jitter: 10%

2. **Moderate** (3 retries) - Default
   - Initial delay: 500ms
   - Max delay: 30s
   - Backoff multiplier: 2x
   - Jitter: 20%

3. **Conservative** (2 retries)
   - Initial delay: 1s
   - Max delay: 60s
   - Backoff multiplier: 2x
   - Jitter: 30%

### Creating Custom Policies

```typescript
const customPolicy = this.retryService.createCustomPolicy(
  maxRetries: 5,
  initialDelayMs: 200,
  maxDelayMs: 15000,
  multiplier: 2.5,
  jitterFactor: 0.15,
  backoffType: 'exponential',
);
```

## Circuit Breaker States

### CLOSED
- Normal operation
- Requests pass through normally
- Failures are monitored

### OPEN
- Failed threshold exceeded
- All requests are rejected immediately
- Fast-fail response with fallback

### HALF_OPEN
- Recovery period after open
- Requests allowed to test if service recovered
- Returns to CLOSED on success, OPEN on failure

## Best Practices

1. **Correlation IDs**
   - Always propagate correlation IDs in logs
   - Use for distributed tracing
   - Track requests across services

2. **Circuit Breakers**
   - Use for external service calls
   - Set appropriate error thresholds
   - Monitor state transitions

3. **Retries**
   - Only retry transient errors
   - Use exponential backoff
   - Implement jitter to prevent thundering herd

4. **Bulkheads**
   - Use for resource-intensive operations
   - Set conservative concurrency limits
   - Re-evaluate limits based on resource usage

5. **Dead Letter Queues**
   - Monitor DLQ message count
   - Implement recovery strategies
   - Set appropriate retention periods

6. **Saga Pattern**
   - Implement compensation for all steps
   - Keep saga steps idempotent
   - Monitor saga execution times

## Troubleshooting

### Circuit Breaker Open

**Issue**: All requests to a service are failing immediately.

**Solution**:
1. Check service health
2. Monitor error rate
3. Use dashboard to inspect errors
4. Reset circuit breaker when service recovers: `POST /api/dashboard/circuit-breakers/{name}/reset`

### Excessive DLQ Messages

**Issue**: Dead letter queue is accumulating messages.

**Solution**:
1. Investigate error cause
2. Review error logs
3. Implement retry logic
4. Fix underlying issue
5. Retry messages from dashboard

### High Error Rate

**Issue**: Many errors are being recorded.

**Solution**:
1. Check system health dashboard
2. Review critical errors
3. Check circuit breaker status
4. Monitor service dependencies
5. Review error distribution

## Advanced Configuration

### Custom Circuit Breaker Options

```typescript
this.circuitBreakerService.register(
  apiCall,
  {
    name: 'premium-api',
    timeout: 3000,
    errorThresholdPercentage: 40,
    volumeThreshold: 20,
    rollingCountTimeout: 120000,
    rollingCountBuckets: 12,
  },
);
```

### Bulkhead Configuration

```typescript
this.bulkheadService.createBulkhead({
  name: 'premium-database',
  maxConcurrent: 50,
  maxQueueSize: 100,
  timeout: 30000,
});
```

### DLQ Configuration

```typescript
this.dlqService.registerDLQ('critical-queue', {
  maxRetries: 5,
  retentionDays: 30,
  notifyOnThreshold: 50,
});
```

## Monitoring Integration

### Metrics Exposed

- Error count by category, severity, and code
- Circuit breaker state and metrics
- Bulkhead concurrency and queue size
- DLQ message count and error distribution
- Error rates (per minute, per hour)
- System health score

### Integration with Monitoring Tools

Export metrics to Prometheus, Grafana, or other monitoring tools using the dashboard endpoints.

## Performance Considerations

1. **Memory Usage**
   - Error events are kept in memory (max 10,000)
   - Old events are periodically cleaned up
   - DLQ messages retained based on configuration

2. **Concurrency**
   - Bulkhead limits prevent resource exhaustion
   - Adjust based on server capacity
   - Monitor queue sizes

3. **Network Calls**
   - Circuit breakers prevent unnecessary calls
   - Retry backoff reduces thundering herd
   - Correlation IDs add minimal overhead

## Support and Debugging

For issues or questions:
1. Check error dashboard for detailed error information
2. Review correlation ID logs for request tracing
3. Inspect circuit breaker state and metrics
4. Verify DLQ configuration and messages
5. Test with manual circuit breaker reset

## References

- [Opossum Circuit Breaker](https://github.com/noderpolish/opossum)
- [Building Resilient Services](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/resilience-tr.pdf)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Bulkhead Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/bulkhead)
