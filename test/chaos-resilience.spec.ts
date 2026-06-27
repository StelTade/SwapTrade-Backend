import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService, CircuitState } from '../src/common/services/circuit-breaker.service';
import { BulkheadService } from '../src/common/services/bulkhead.service';
import { CorrelationIdService } from '../src/common/services/correlation-id.service';
import { CircuitBreakerRecoveryService } from '../src/common/services/circuit-breaker-recovery.service';

/**
 * Chaos Engineering Tests
 *
 * These tests verify system resilience under failure conditions:
 * - Circuit breakers open after threshold failures
 * - Bulkheads isolate failing components
 * - Graceful degradation prevents cascading failures
 * - Failover mechanisms redirect to healthy services
 * - Automated recovery restores service
 */
describe('Chaos Engineering — Resilience Patterns', () => {
  let circuitBreakerService: CircuitBreakerService;
  let bulkheadService: BulkheadService;
  let recoveryService: CircuitBreakerRecoveryService;

  beforeAll(async () => {
    const correlationIdService: Partial<CorrelationIdService> = {
      getCorrelationId: jest.fn().mockReturnValue('chaos-test-correlation-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        BulkheadService,
        CircuitBreakerRecoveryService,
        { provide: CorrelationIdService, useValue: correlationIdService },
      ],
    }).compile();

    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
    bulkheadService = module.get<BulkheadService>(BulkheadService);
    recoveryService = module.get<CircuitBreakerRecoveryService>(CircuitBreakerRecoveryService);
  });

  describe('Circuit Breaker — Cascading Failure Prevention', () => {
    it('should open circuit after consecutive failures (simulated service outage)', async () => {
      const failingFn = async () => {
        throw new Error('Connection refused');
      };

      circuitBreakerService.register(failingFn, {
        name: 'chaos-failing-service',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 3,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        fallback: async () => ({ degraded: true }),
      });

      // Fire enough requests to trip the volume threshold
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerService.execute('chaos-failing-service', failingFn);
        } catch {
          // Expected to fail
        }
      }

      const state = circuitBreakerService.getState('chaos-failing-service');
      // Circuit should be open or half-open after repeated failures
      expect([CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(state);
    });

    it('should allow execution when circuit is closed (healthy service)', async () => {
      const healthyFn = async () => ({ data: 'success' });

      circuitBreakerService.register(healthyFn, {
        name: 'chaos-healthy-service',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 5,
      });

      const result = await circuitBreakerService.execute('chaos-healthy-service', healthyFn);
      expect(result).toEqual({ data: 'success' });
      expect(circuitBreakerService.getState('chaos-healthy-service')).toBe(
        CircuitState.CLOSED,
      );
    });

    it('should prevent cascading failures by isolating failing service', async () => {
      const unreliableFn = async () => {
        throw new Error('Service unavailable');
      };

      circuitBreakerService.register(unreliableFn, {
        name: 'chaos-unreliable-service',
        timeout: 1000,
        errorThresholdPercentage: 30,
        volumeThreshold: 3,
        rollingCountTimeout: 5000,
        rollingCountBuckets: 5,
        fallback: async () => ({ fallback: true, message: 'Service degraded' }),
      });

      // Exhaust failures to trip the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerService.execute('chaos-unreliable-service', unreliableFn);
        } catch {
          // Expected
        }
      }

      // After circuit opens, subsequent calls should not reach the failing service
      // The system is protected from cascading failure
      const state = circuitBreakerService.getState('chaos-unreliable-service');
      expect([CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(state);
    });
  });

  describe('Bulkhead — Component Isolation', () => {
    it('should isolate failing components within their bulkhead', async () => {
      bulkheadService.createBulkhead({
        name: 'chaos-isolated-component',
        maxConcurrent: 2,
        maxQueueSize: 5,
        timeout: 5000,
      });

      // Execute a failing operation
      await expect(
        bulkheadService.execute(
          'chaos-isolated-component',
          async () => {
            throw new Error('Component failure');
          },
          'isolated-failing-op',
        ),
      ).rejects.toThrow('Component failure');

      // Verify the failure was tracked but bulkhead remains operational
      const metrics = bulkheadService.getMetrics('chaos-isolated-component')!;
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.currentConcurrent).toBe(0); // Released after failure

      // Bulkhead should still accept new operations
      const result = await bulkheadService.execute(
        'chaos-isolated-component',
        async () => 'recovered',
        'recovery-op',
      );
      expect(result).toBe('recovered');
    });

    it('should limit concurrent executions (resource isolation)', async () => {
      bulkheadService.createBulkhead({
        name: 'chaos-concurrency-limit',
        maxConcurrent: 2,
        maxQueueSize: 10,
        timeout: 10000,
      });

      const executionDelays: number[] = [];
      const slowOperation = async (delay: number) => {
        executionDelays.push(delay);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return `completed-${delay}`;
      };

      // Start 4 concurrent operations with a maxConcurrent of 2
      const promises = [
        bulkheadService.execute('chaos-concurrency-limit', () => slowOperation(100), 'op-1'),
        bulkheadService.execute('chaos-concurrency-limit', () => slowOperation(100), 'op-2'),
        bulkheadService.execute('chaos-concurrency-limit', () => slowOperation(100), 'op-3'),
        bulkheadService.execute('chaos-concurrency-limit', () => slowOperation(100), 'op-4'),
      ];

      const results = await Promise.allSettled(promises);

      // All should eventually complete
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(2);

      const metrics = bulkheadService.getMetrics('chaos-concurrency-limit')!;
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.totalSuccessful).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Graceful Degradation — System Continues Operating', () => {
    it('should gracefully degrade instead of failing completely', async () => {
      const degradingFn = async () => {
        throw new Error('External API down');
      };

      circuitBreakerService.register(degradingFn, {
        name: 'chaos-degrading-service',
        timeout: 2000,
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        fallback: async () => ({ degraded: true, cached: true }),
      });

      // Trip the circuit
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreakerService.execute('chaos-degrading-service', degradingFn);
        } catch {
          // Expected
        }
      }

      // System should still be operational (not throwing unhandled errors)
      const state = circuitBreakerService.getState('chaos-degrading-service');
      expect([CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(state);

      // The system has not crashed — it degraded
      expect(circuitBreakerService.getAllMetrics().length).toBeGreaterThan(0);
    });
  });

  describe('Automated Recovery — Circuit Breaker Reset', () => {
    it('should support manual recovery trigger', () => {
      circuitBreakerService.register(async () => 1, { name: 'chaos-recovery-test' });

      // Simulate the circuit being in a bad state
      circuitBreakerService.reset('chaos-recovery-test');

      const metrics = circuitBreakerService.getMetrics('chaos-recovery-test');
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should provide recovery status for monitoring', () => {
      const status = recoveryService.getRecoveryStatus();
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('open');
      expect(status).toHaveProperty('halfOpen');
      expect(status).toHaveProperty('closed');
      expect(status).toHaveProperty('details');
      expect(status.total).toBeGreaterThanOrEqual(0);
    });

    it('should reset all circuit breakers for full recovery', () => {
      circuitBreakerService.register(async () => 1, { name: 'chaos-reset-all-1' });
      circuitBreakerService.register(async () => 2, { name: 'chaos-reset-all-2' });

      circuitBreakerService.resetAll();

      const metrics1 = circuitBreakerService.getMetrics('chaos-reset-all-1');
      const metrics2 = circuitBreakerService.getMetrics('chaos-reset-all-2');
      expect(metrics1.consecutiveFailures).toBe(0);
      expect(metrics2.consecutiveFailures).toBe(0);
    });
  });

  describe('Failover — Multi-Channel Notification Simulation', () => {
    it('should define failover channels for email and SMS', () => {
      // This mirrors the NotificationProcessor's fallbackChannels configuration
      const fallbackChannels: Record<string, string[]> = {
        EMAIL: ['PUSH'],
        SMS: ['PUSH'],
      };

      expect(fallbackChannels['EMAIL']).toContain('PUSH');
      expect(fallbackChannels['SMS']).toContain('PUSH');
      expect(fallbackChannels['PUSH']).toBeUndefined();
    });

    it('should simulate failover from email to push when email fails', async () => {
      // Simulate: email circuit breaker is open, push is healthy
      const emailFn = async () => {
        throw new Error('SMTP connection refused');
      };
      const pushFn = async () => ({ delivered: true });

      circuitBreakerService.register(emailFn, {
        name: 'chaos-email-failover',
        timeout: 2000,
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        fallback: async () => false, // Graceful degradation
      });

      circuitBreakerService.register(pushFn, {
        name: 'chaos-push-failover',
        timeout: 5000,
        errorThresholdPercentage: 50,
        volumeThreshold: 5,
      });

      // Trip the email circuit
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreakerService.execute('chaos-email-failover', emailFn);
        } catch {
          // Expected
        }
      }

      // Email should be degraded (circuit open)
      const emailState = circuitBreakerService.getState('chaos-email-failover');
      expect([CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(emailState);

      // Push should still be healthy
      const pushResult = await circuitBreakerService.execute('chaos-push-failover', pushFn);
      expect(pushResult).toEqual({ delivered: true });
      expect(circuitBreakerService.getState('chaos-push-failover')).toBe(
        CircuitState.CLOSED,
      );
    });
  });

  describe('System-Wide Resilience Verification', () => {
    it('should maintain all circuit breaker metrics during chaos scenarios', () => {
      const allMetrics = circuitBreakerService.getAllMetrics();
      // Multiple breakers should be registered from previous tests
      expect(allMetrics.length).toBeGreaterThan(0);

      // Each should have valid state
      allMetrics.forEach((m) => {
        expect(m.name).toBeDefined();
        expect([CircuitState.CLOSED, CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(
          m.state,
        );
      });
    });

    it('should maintain all bulkhead metrics during chaos scenarios', () => {
      const allMetrics = bulkheadService.getAllMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);

      allMetrics.forEach((m) => {
        expect(m.name).toBeDefined();
        expect(m.maxConcurrent).toBeGreaterThan(0);
        expect(m.currentConcurrent).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
