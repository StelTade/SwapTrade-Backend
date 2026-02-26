import { Test, TestingModule } from '@nestjs/testing';

import { BulkheadService } from 'src/common/services/bulkhead.service';
import { CircuitBreakerService } from 'src/common/services/circuit-breaker.service';
import { CorrelationIdService } from 'src/common/services/correlation-id.service';
import { ErrorMonitoringService } from 'src/common/services/error-monitoring.service';
import { RetryService } from 'src/common/services/retry.service';
import { SagaService, type SagaStep } from 'src/common/services/saga.service';
import { DeadLetterQueueService } from 'src/common/services/dead-letter-queue.service';
import { ErrorCategorizer, ErrorCategory } from 'src/common/exceptions/error-categorizer';

describe('Error Handling System', () => {
  let correlationIdService: CorrelationIdService;
  let circuitBreakerService: CircuitBreakerService;
  let retryService: RetryService;
  let bulkheadService: BulkheadService;
  let deadLetterQueueService: DeadLetterQueueService;
  let sagaService: SagaService;
  let errorMonitoringService: ErrorMonitoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationIdService,
        CircuitBreakerService,
        RetryService,
        BulkheadService,
        DeadLetterQueueService,
        SagaService,
        ErrorMonitoringService,
      ],
    }).compile();

    correlationIdService = module.get<CorrelationIdService>(CorrelationIdService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    retryService = module.get<RetryService>(RetryService);
    bulkheadService = module.get<BulkheadService>(BulkheadService);
    deadLetterQueueService = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    sagaService = module.get<SagaService>(SagaService);
    errorMonitoringService = module.get<ErrorMonitoringService>(ErrorMonitoringService);
  });

  describe('CorrelationIdService', () => {
    it('should create a new correlation context', () => {
      const context = correlationIdService.createContext('user123');

      expect(context.correlationId).toBeDefined();
      expect(context.traceId).toBeDefined();
      expect(context.requestId).toBeDefined();
      expect(context.userId).toBe('user123');
      expect(context.timestamp).toBeDefined();
    });

    it('should set and retrieve context', () => {
      const context = correlationIdService.createContext('user456');

      correlationIdService.setContext(context, () => {
        expect(correlationIdService.getCorrelationId()).toBe(context.correlationId);
        expect(correlationIdService.getTraceId()).toBe(context.traceId);
        expect(correlationIdService.getUserId()).toBe('user456');
      });
    });

    it('should generate context headers', () => {
      const context = correlationIdService.createContext('user789');

      correlationIdService.setContext(context, () => {
        const headers = correlationIdService.getContextHeaders();

        expect(headers['x-correlation-id']).toBe(context.correlationId);
        expect(headers['x-trace-id']).toBe(context.traceId);
        expect(headers['x-request-id']).toBe(context.requestId);
        expect(headers['x-user-id']).toBe('user789');
      });
    });

    it('should create context from headers', () => {
      const headers = {
        'x-correlation-id': 'test-correlation',
        'x-trace-id': 'test-trace',
        'x-request-id': 'test-request',
      };

      const context = correlationIdService.createContextFromHeaders(headers, 'user001');

      expect(context.correlationId).toBe('test-correlation');
      expect(context.traceId).toBe('test-trace');
      expect(context.requestId).toBe('test-request');
      expect(context.userId).toBe('user001');
    });
  });

  describe('ErrorCategorizer', () => {
    it('should categorize transient errors', () => {
      const error = new Error('ECONNREFUSED');
      const errorInfo = ErrorCategorizer.categorize(error);

      expect(errorInfo.category).toBe(ErrorCategory.TRANSIENT);
      expect(errorInfo.retryable).toBe(true);
      expect(errorInfo.maxRetries).toBeGreaterThan(0);
    });

    it('should categorize permanent errors', () => {
      const error = new Error('400');
      (error as any).code = '400';
      const errorInfo = ErrorCategorizer.categorize(error);

      expect(errorInfo.category).toBe(ErrorCategory.PERMANENT);
      expect(errorInfo.retryable).toBe(false);
    });

    it('should detect rate limit errors', () => {
      const error = new Error('429');
      (error as any).code = '429';
      const errorInfo = ErrorCategorizer.categorize(error);

      expect(errorInfo.errorType).toBe('RATE_LIMIT');
      expect(errorInfo.retryable).toBe(true);
      expect(errorInfo.maxRetries).toBe(3);
    });

    it('should detect timeout errors', () => {
      const error = new Error('ETIMEDOUT');
      const errorInfo = ErrorCategorizer.categorize(error);

      expect(errorInfo.errorType).toBe('TIMEOUT');
      expect(errorInfo.retryable).toBe(true);
    });
  });

  describe('RetryService', () => {
    it('should retry and succeed on third attempt', async () => {
      let attempts = 0;

      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNREFUSED');
        }
        return 'success';
      };

      const result = await retryService.executeWithRetry(fn, 'aggressive');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const fn = async () => {
        throw new Error('Persistent error');
      };

      const result = await retryService.executeWithRetry(fn, 'conservative');

      expect(result.success).toBe(false);
      expect(result.lastError).toBeDefined();
      expect(result.attempts).toBeGreaterThan(1);
    });

    it('should not retry permanent errors', async () => {
      let attempts = 0;

      const fn = async () => {
        attempts++;
        const error = new Error('Validation failed');
        (error as any).code = '400';
        throw error;
      };

      const result = await retryService.executeWithRetry(fn, 'moderate');

      expect(result.success).toBe(false);
      expect(attempts).toBe(1); // Only one attempt for permanent error
    });

    it('should apply exponential backoff', async () => {
      const policy = retryService.getPolicy('moderate');

      expect(policy.maxRetries).toBe(3);
      expect(policy.backoffType).toBe('exponential');
      expect(policy.multiplier).toBe(2);
      expect(policy.jitterFactor).toBeGreaterThan(0);
    });
  });

  describe('CircuitBreakerService', () => {
    it('should register a circuit breaker', () => {
      const fn = async () => 'result';

      const result = circuitBreakerService.register(fn, {
        name: 'test-breaker',
        timeout: 5000,
        errorThresholdPercentage: 50,
      });

      expect(result).toBeDefined();
      expect(circuitBreakerService.getState('test-breaker')).toBe('CLOSED');
    });

    it('should track successful executions', async () => {
      const fn = async () => 'success';

      circuitBreakerService.register(fn, {
        name: 'success-breaker',
      });

      const result = await circuitBreakerService.execute(
        'success-breaker',
        fn,
      );

      expect(result).toBe('success');
    });

    it('should get circuit breaker metrics', () => {
      const fn = async () => 'result';

      circuitBreakerService.register(fn, {
        name: 'metrics-breaker',
      });

      const metrics = circuitBreakerService.getMetrics('metrics-breaker');

      expect(metrics.name).toBe('metrics-breaker');
      expect(metrics.state).toBeDefined();
    });

    it('should reset circuit breaker', async () => {
      const fn = async () => 'result';

      circuitBreakerService.register(fn, {
        name: 'reset-breaker',
      });

      circuitBreakerService.reset('reset-breaker');

      expect(circuitBreakerService.getState('reset-breaker')).toBe('CLOSED');
    });
  });

  describe('BulkheadService', () => {
    it('should create a bulkhead', () => {
      bulkheadService.createBulkhead({
        name: 'test-bulkhead',
        maxConcurrent: 5,
      });

      const metrics = bulkheadService.getMetrics('test-bulkhead');

      expect(metrics).toBeDefined();
      expect(metrics!.maxConcurrent).toBe(5);
      expect(metrics!.currentConcurrent).toBe(0);
    });

    it('should execute function within bulkhead limits', async () => {
      bulkheadService.createBulkhead({
        name: 'exec-bulkhead',
        maxConcurrent: 2,
      });

      const fn = async () => 'result';

      const result = await bulkheadService.execute(
        'exec-bulkhead',
        fn,
        'testFunction',
      );

      expect(result).toBe('result');
    });

    it('should track bulkhead metrics', async () => {
      bulkheadService.createBulkhead({
        name: 'metric-bulkhead',
        maxConcurrent: 3,
      });

      const fn = async () => 'result';

      await bulkheadService.execute('metric-bulkhead', fn);

      const metrics = bulkheadService.getMetrics('metric-bulkhead');

      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.totalSuccessful).toBe(1);
    });
  });

  describe('DeadLetterQueueService', () => {
    it('should register a DLQ', () => {
      deadLetterQueueService.registerDLQ('test-queue', {
        maxRetries: 3,
        retentionDays: 7,
      });

      const stats = deadLetterQueueService.getDLQStats();

      expect(stats['test-queue']).toBeDefined();
    });

    it('should send message to DLQ', async () => {
      deadLetterQueueService.registerDLQ('dlq-test-queue', {
        maxRetries: 3,
        retentionDays: 7,
      });

      const error = new Error('Test error');

      await deadLetterQueueService.sendToDLQ(
        'dlq-test-queue',
        'job123',
        'testFunction',
        { data: 'test' },
        error,
        3,
      );

      const messages = deadLetterQueueService.getDLQMessages('dlq-test-queue');

      expect(messages.length).toBe(1);
      expect(messages[0].functionName).toBe('testFunction');
    });

    it('should retrieve DLQ messages', async () => {
      deadLetterQueueService.registerDLQ('retrieve-queue', {
        maxRetries: 3,
        retentionDays: 7,
      });

      const error = new Error('Error 1');
      await deadLetterQueueService.sendToDLQ(
        'retrieve-queue',
        'job1',
        'func1',
        { data: 'test' },
        error,
        1,
      );

      const messages = deadLetterQueueService.getDLQMessages('retrieve-queue');

      expect(messages.length).toBe(1);
    });

    it('should subscribe to DLQ messages', async () => {
      deadLetterQueueService.registerDLQ('subscribe-queue', {
        maxRetries: 3,
        retentionDays: 7,
      });

      let received = false;

      deadLetterQueueService.onDLQMessage('subscribe-queue', (msg) => {
        received = true;
      });

      const error = new Error('Test error');
      await deadLetterQueueService.sendToDLQ(
        'subscribe-queue',
        'job1',
        'func1',
        {},
        error,
        1,
      );

      expect(received).toBe(true);
    });
  });

  describe('SagaService', () => {
    it('should execute saga successfully', async () => {
      const steps: SagaStep[] = [
        {
          name: 'step1',
          action: async () => 'result1',
        },
        {
          name: 'step2',
          action: async () => 'result2',
        },
      ];

      const result = await sagaService.executeSaga('test-saga', steps);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toContain('step1');
      expect(result.completedSteps).toContain('step2');
    });

    it('should compensate on failure', async () => {
      const compensations: string[] = [];

      const steps: SagaStep[] = [
        {
          name: 'step1',
          action: async () => 'result1',
          compensation: async () => {
            compensations.push('compensated-step1');
          },
        },
        {
          name: 'step2',
          action: async () => {
            throw new Error('Step 2 failed');
          },
          compensation: async () => {
            compensations.push('compensated-step2');
          },
        },
      ];

      const result = await sagaService.executeSaga('fail-saga', steps);

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('step2');
      expect(compensations).toContain('compensated-step1');
    });

    it('should execute parallel steps', async () => {
      const steps: SagaStep[] = [
        {
          name: 'parallel1',
          action: async () => 'result1',
        },
        {
          name: 'parallel2',
          action: async () => 'result2',
        },
        {
          name: 'parallel3',
          action: async () => 'result3',
        },
      ];

      const result = await sagaService.executeParallelSteps('parallel-saga', steps);

      expect(result.success).toBe(true);
      expect(result.completedSteps.length).toBe(3);
    });
  });

  describe('ErrorMonitoringService', () => {
    it('should record an error', () => {
      const error = new Error('Test error');

      errorMonitoringService.recordError(error, {
        correlationId: 'test-123',
        userId: 'user456',
      });

      const metrics = errorMonitoringService.getMetrics();

      expect(metrics.totalErrors).toBe(1);
    });

    it('should get error metrics', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      errorMonitoringService.recordError(error1);
      errorMonitoringService.recordError(error2);

      const metrics = errorMonitoringService.getMetrics();

      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByCategory).toBeDefined();
    });

    it('should get critical errors', () => {
      const error = new Error('Critical error');

      errorMonitoringService.recordError(error, {
        severity: 'CRITICAL' as any,
      });

      const critical = errorMonitoringService.getCriticalErrors();

      expect(critical.length).toBeGreaterThan(0);
    });

    it('should clear old events', () => {
      const error = new Error('Test error');

      errorMonitoringService.recordError(error);

      const initialCount = errorMonitoringService.getEventCount();

      const removed = errorMonitoringService.clearOldEvents(0);

      const finalCount = errorMonitoringService.getEventCount();

      expect(initialCount).toBeGreaterThan(finalCount);
    });

    it('should clear all events', () => {
      const error = new Error('Test error');

      errorMonitoringService.recordError(error);

      const count = errorMonitoringService.clearAll();

      expect(count).toBeGreaterThan(0);
      expect(errorMonitoringService.getEventCount()).toBe(0);
    });
  });
});
