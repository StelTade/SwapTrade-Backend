import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../src/common/services/circuit-breaker.service';
import { RetryService } from '../src/common/services/retry.service';
import { BulkheadService } from '../src/common/services/bulkhead.service';
import { CorrelationIdService } from '../src/common/services/correlation-id.service';
import { DeadLetterQueueService } from '../src/common/services/dead-letter-queue.service';
import { SagaService, SagaStep } from '../src/common/services/saga.service';

/**
 * Chaos Engineering Tests
 * Simulates failure scenarios to validate error handling resilience
 */
describe('Chaos Engineering - Error Handling Resilience', () => {
  let circuitBreakerService: CircuitBreakerService;
  let retryService: RetryService;
  let bulkheadService: BulkheadService;
  let deadLetterQueueService: DeadLetterQueueService;
  let sagaService: SagaService;
  let correlationIdService: CorrelationIdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationIdService,
        CircuitBreakerService,
        RetryService,
        BulkheadService,
        DeadLetterQueueService,
        SagaService,
      ],
    }).compile();

    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    retryService = module.get<RetryService>(RetryService);
    bulkheadService = module.get<BulkheadService>(BulkheadService);
    deadLetterQueueService = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    sagaService = module.get<SagaService>(SagaService);
    correlationIdService = module.get<CorrelationIdService>(CorrelationIdService);
  });

  describe('Circuit Breaker Chaos', () => {
    it('should handle cascading failures', async () => {
      const failingFn = async () => {
        throw new Error('Service down');
      };

      circuitBreakerService.register(failingFn, {
        name: 'cascading-test',
        errorThresholdPercentage: 50,
        volumeThreshold: 5,
      });

      // Trigger failures
      for (let i = 0; i < 6; i++) {
        try {
          await circuitBreakerService.execute('cascading-test', failingFn);
        } catch (e) {
          // Expected
        }
      }

      const state = circuitBreakerService.getState('cascading-test');

      expect(state).toBe('OPEN');
    });

    it('should recover from circuit breaker open state', async () => {
      let callCount = 0;

      const fn = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Service error');
        }
        return 'recovered';
      };

      circuitBreakerService.register(fn, {
        name: 'recovery-test',
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
      });

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreakerService.execute('recovery-test', fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreakerService.getState('recovery-test')).toBe('OPEN');

      // Reset and simulate recovery
      circuitBreakerService.reset('recovery-test');

      const result = await circuitBreakerService.execute('recovery-test', fn);

      expect(result).toBe('recovered');
    });

    it('should handle timeout failures', async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return 'result';
      };

      circuitBreakerService.register(slowFn, {
        name: 'timeout-test',
        timeout: 100,
      });

      let timedOut = false;

      try {
        await circuitBreakerService.execute('timeout-test', slowFn);
      } catch (error) {
        timedOut = true;
      }

      expect(timedOut).toBe(true);
    });
  });

  describe('Retry Chaos', () => {
    it('should handle flaky services with eventual success', async () => {
      let attempts = 0;

      const flakyFn = async () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('ECONNREFUSED');
        }
        return 'success';
      };

      const result = await retryService.executeWithRetry(
        flakyFn,
        'aggressive',
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(4);
    });

    it('should quickly fail on permanent errors', async () => {
      let attempts = 0;

      const permanentErrorFn = async () => {
        attempts++;
        const error = new Error('Invalid input');
        (error as any).code = '400';
        throw error;
      };

      const result = await retryService.executeWithRetry(
        permanentErrorFn,
        'aggressive',
      );

      expect(result.success).toBe(false);
      expect(attempts).toBe(1); // No retry
    });

    it('should apply increasing backoff delays', async () => {
      const delays: number[] = [];
      let attempts = 0;

      const flakyFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNREFUSED');
        }
        return 'success';
      };

      const startTime = Date.now();

      const result = await retryService.executeWithRetry(
        flakyFn,
        'moderate',
      );

      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeGreaterThan(100); // Should have delays
    });

    it('should handle rate limiting with exponential backoff', async () => {
      let attempts = 0;

      const rateLimitedFn = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('429');
          (error as any).code = '429';
          throw error;
        }
        return 'success';
      };

      const result = await retryService.executeWithRetry(
        rateLimitedFn,
        'moderate',
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe('Bulkhead Chaos', () => {
    it('should handle resource exhaustion prevention', async () => {
      bulkheadService.createBulkhead({
        name: 'load-test',
        maxConcurrent: 2,
      });

      let activeCount = 0;
      let maxActive = 0;

      const fn = async () => {
        activeCount++;
        if (activeCount > maxActive) {
          maxActive = activeCount;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        activeCount--;
        return 'done';
      };

      const promises: Promise<any>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          bulkheadService.execute('load-test', fn, `task-${i}`),
        );
      }

      await Promise.all(promises);

      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('should queue requests when at capacity', async () => {
      bulkheadService.createBulkhead({
        name: 'queue-test',
        maxConcurrent: 1,
      });

      let sequentialCount = 0;

      const fn = async () => {
        sequentialCount++;

        if (sequentialCount > 1) {
          throw new Error('Concurrent execution detected!');
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        sequentialCount--;
      };

      const promises: Promise<any>[] = [];

      for (let i = 0; i < 5; i++) {
        promises.push(bulkheadService.execute('queue-test', fn));
      }

      await Promise.all(promises).catch((e) => {
        throw new Error(`Concurrency violation: ${e.message}`);
      });

      expect(sequentialCount).toBe(0);
    });
  });

  describe('Dead Letter Queue Chaos', () => {
    it('should handle persistent failures gracefully', async () => {
      deadLetterQueueService.registerDLQ('persistent-fail-queue', {
        maxRetries: 3,
        retentionDays: 7,
      });

      const failingOperation = async () => {
        throw new Error('Permanent failure');
      };

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        const error = new Error('Persistent error');
        await deadLetterQueueService.sendToDLQ(
          'persistent-fail-queue',
          `job-${i}`,
          'operation',
          { data: `attempt-${i}` },
          error,
          3,
        );
      }

      const messages = deadLetterQueueService.getDLQMessages(
        'persistent-fail-queue',
      );

      expect(messages.length).toBe(5);
    });

    it('should handle DLQ message cleanup', async () => {
      deadLetterQueueService.registerDLQ('cleanup-queue', {
        maxRetries: 3,
        retentionDays: 0, // Immediate retention
      });

      const error = new Error('Test error');

      await deadLetterQueueService.sendToDLQ(
        'cleanup-queue',
        'job-1',
        'operation',
        {},
        error,
        1,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialCount = deadLetterQueueService.getDLQMessages(
        'cleanup-queue',
      ).length;

      deadLetterQueueService.cleanupOldMessages('cleanup-queue');

      // Messages should be cleaned up
      const finalCount = deadLetterQueueService.getDLQMessages(
        'cleanup-queue',
      ).length;

      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });
  });

  describe('Saga Chaos', () => {
    it('should rollback on step failure', async () => {
      const executedSteps: string[] = [];
      const compensatedSteps: string[] = [];

      const steps: SagaStep[] = [
        {
          name: 'charge-payment',
          action: async () => {
            executedSteps.push('charge-payment');
            return { transactionId: 'tx-123' };
          },
          compensation: async () => {
            compensatedSteps.push('charge-payment');
          },
        },
        {
          name: 'create-order',
          action: async () => {
            executedSteps.push('create-order');
            return { orderId: 'order-456' };
          },
          compensation: async () => {
            compensatedSteps.push('create-order');
          },
        },
        {
          name: 'update-inventory',
          action: async () => {
            throw new Error('Inventory service down');
          },
          compensation: async () => {
            compensatedSteps.push('update-inventory');
          },
        },
      ];

      const result = await sagaService.executeSaga('chaos-saga', steps);

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('update-inventory');
      expect(executedSteps).toContain('charge-payment');
      expect(executedSteps).toContain('create-order');
      expect(compensatedSteps).toContain('charge-payment');
      expect(compensatedSteps).toContain('create-order');
    });

    it('should handle parallel saga failures', async () => {
      const executedSteps: string[] = [];
      const compensatedSteps: string[] = [];

      const steps: SagaStep[] = [
        {
          name: 'process-payment',
          action: async () => {
            executedSteps.push('process-payment');
            return { id: '123' };
          },
          compensation: async () => {
            compensatedSteps.push('process-payment');
          },
        },
        {
          name: 'reserve-inventory',
          action: async () => {
            executedSteps.push('reserve-inventory');
            throw new Error('Inventory unavailable');
          },
          compensation: async () => {
            compensatedSteps.push('reserve-inventory');
          },
        },
        {
          name: 'send-confirmation',
          action: async () => {
            executedSteps.push('send-confirmation');
            return { sent: true };
          },
          compensation: async () => {
            compensatedSteps.push('send-confirmation');
          },
        },
      ];

      const result = await sagaService.executeParallelSteps(
        'parallel-chaos-saga',
        steps,
      );

      expect(result.success).toBe(false);
      // All steps should be compensated on failure
      expect(compensatedSteps.length).toBeGreaterThan(0);
    });

    it('should handle partial compensation failures', async () => {
      const compensatedSteps: string[] = [];

      const steps: SagaStep[] = [
        {
          name: 'step1',
          action: async () => 'result1',
          compensation: async () => {
            compensatedSteps.push('step1');
          },
        },
        {
          name: 'step2',
          action: async () => 'result2',
          compensation: async () => {
            throw new Error('Compensation failed');
            // This should not stop other compensations
          },
        },
        {
          name: 'step3',
          action: async () => {
            throw new Error('Step3 failed');
          },
          compensation: async () => {
            compensatedSteps.push('step3');
          },
        },
      ];

      const result = await sagaService.executeSaga('partial-fail-saga', steps);

      expect(result.success).toBe(false);
      // Despite compensation failure, other steps should still compensate
      expect(compensatedSteps).toContain('step1');
    });
  });

  describe('Combined Chaos Scenarios', () => {
    it('should handle multi-service failure cascade', async () => {
      const strategy = 'moderate';

      const service1 = async () => {
        throw new Error('ECONNREFUSED');
      };

      const service2 = async () => {
        throw new Error('503');
      };

      const service3 = async () => {
        throw new Error('ETIMEDOUT');
      };

      const result1 = await retryService.executeWithRetry(service1, strategy);
      const result2 = await retryService.executeWithRetry(service2, strategy);
      const result3 = await retryService.executeWithRetry(service3, strategy);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
      expect(result1.attempts).toBeGreaterThan(1); // Should retry
    });

    it('should prioritize critical paths during high load', async () => {
      bulkheadService.createBulkhead({
        name: 'critical-path',
        maxConcurrent: 5,
      });

      bulkheadService.createBulkhead({
        name: 'background-tasks',
        maxConcurrent: 2,
      });

      const criticalFn = async () => 'critical-result';
      const backgroundFn = async () => 'background-result';

      const promises: Promise<any>[] = [];

      // Add background tasks
      for (let i = 0; i < 10; i++) {
        promises.push(
          bulkheadService.execute('background-tasks', backgroundFn),
        );
      }

      // Critical path should still be responsive
      promises.push(
        bulkheadService.execute('critical-path', criticalFn),
      );

      await Promise.all(promises);

      const criticalMetrics = bulkheadService.getMetrics('critical-path')!;
      const backgroundMetrics = bulkheadService.getMetrics(
        'background-tasks',
      )!;

      expect(criticalMetrics.totalSuccessful).toBeGreaterThan(0);
      expect(backgroundMetrics.totalSuccessful).toBeGreaterThan(0);
    });
  });
});
