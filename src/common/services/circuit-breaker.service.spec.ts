import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService, CircuitState, CircuitBreakerOptions } from './circuit-breaker.service';
import { CorrelationIdService } from './correlation-id.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let correlationIdService: Partial<CorrelationIdService>;

  beforeEach(async () => {
    correlationIdService = {
      getCorrelationId: jest.fn().mockReturnValue('test-correlation-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: CorrelationIdService, useValue: correlationIdService },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a circuit breaker', () => {
      const fn = async () => ({ success: true });
      const options: CircuitBreakerOptions = { name: 'test-service' };

      service.register(fn, options);

      expect(service.getState('test-service')).toBe(CircuitState.CLOSED);
    });

    it('should warn and return original function if already registered', () => {
      const fn = async () => ({ success: true });
      const options: CircuitBreakerOptions = { name: 'duplicate-service' };

      service.register(fn, options);
      service.register(fn, options); // Second registration

      expect(service.getState('duplicate-service')).toBe(CircuitState.CLOSED);
    });
  });

  describe('execute', () => {
    it('should execute function when breaker is closed', async () => {
      const fn = async (x: number) => x * 2;
      service.register(fn, { name: 'math-service' });

      const result = await service.execute('math-service', fn, 5);
      expect(result).toBe(10);
    });

    it('should execute without protection when breaker not found', async () => {
      const fn = async () => 'direct-result';
      const result = await service.execute('non-existent', fn);
      expect(result).toBe('direct-result');
    });

    it('should throw when function fails', async () => {
      const fn = async () => {
        throw new Error('Service error');
      };
      service.register(fn, {
        name: 'failing-service',
        errorThresholdPercentage: 100,
        volumeThreshold: 1,
      });

      await expect(service.execute('failing-service', fn)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('getState', () => {
    it('should return CLOSED for non-existent breaker', () => {
      expect(service.getState('non-existent')).toBe(CircuitState.CLOSED);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for registered breaker', async () => {
      const fn = async () => 'success';
      service.register(fn, { name: 'metrics-service' });

      await service.execute('metrics-service', fn);

      const metrics = service.getMetrics('metrics-service');
      expect(metrics.name).toBe('metrics-service');
    });

    it('should return empty metrics for non-existent breaker', () => {
      const metrics = service.getMetrics('non-existent');
      expect(metrics.name).toBe('non-existent');
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all registered breaker metrics', () => {
      service.register(async () => 1, { name: 'service-a' });
      service.register(async () => 2, { name: 'service-b' });

      const allMetrics = service.getAllMetrics();
      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map((m) => m.name)).toContain('service-a');
      expect(allMetrics.map((m) => m.name)).toContain('service-b');
    });
  });

  describe('reset', () => {
    it('should reset a specific breaker', () => {
      service.register(async () => 1, { name: 'reset-service' });
      service.reset('reset-service');

      const metrics = service.getMetrics('reset-service');
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('should reset all breakers', () => {
      service.register(async () => 1, { name: 'service-x' });
      service.register(async () => 2, { name: 'service-y' });

      service.resetAll();

      const metricsX = service.getMetrics('service-x');
      const metricsY = service.getMetrics('service-y');
      expect(metricsX.consecutiveFailures).toBe(0);
      expect(metricsY.consecutiveFailures).toBe(0);
    });
  });
});
