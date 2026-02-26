import { Module } from '@nestjs/common';
import { CorrelationIdService } from './services/correlation-id.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { RetryService } from './services/retry.service';
import { BulkheadService } from './services/bulkhead.service';
import { DeadLetterQueueService } from './services/dead-letter-queue.service';
import { SagaService } from './services/saga.service';
import { ErrorMonitoringService } from './services/error-monitoring.service';
import { ErrorDashboardController } from './controllers/error-dashboard.controller';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';

/**
 * Error Handling Module
 * Provides comprehensive error handling infrastructure including:
 * - Circuit breakers with Opossum
 * - Exponential backoff retry logic
 * - Dead letter queue management
 * - Correlation ID propagation
 * - Bulkhead pattern for isolation
 * - Saga pattern for distributed transactions
 * - Error monitoring and dashboards
 */
@Module({
  providers: [
    CorrelationIdService,
    CircuitBreakerService,
    RetryService,
    BulkheadService,
    DeadLetterQueueService,
    SagaService,
    ErrorMonitoringService,
    CorrelationIdMiddleware,
  ],
  controllers: [ErrorDashboardController],
  exports: [
    CorrelationIdService,
    CircuitBreakerService,
    RetryService,
    BulkheadService,
    DeadLetterQueueService,
    SagaService,
    ErrorMonitoringService,
    CorrelationIdMiddleware,
  ],
})
export class ErrorHandlingModule {}
