import { Test, TestingModule } from '@nestjs/testing';
import { BulkheadService, BulkheadConfig } from './bulkhead.service';
import { CorrelationIdService } from './correlation-id.service';

describe('BulkheadService', () => {
  let service: BulkheadService;
  let correlationIdService: Partial<CorrelationIdService>;

  beforeEach(async () => {
    correlationIdService = {
      getCorrelationId: jest.fn().mockReturnValue('test-correlation-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkheadService,
        { provide: CorrelationIdService, useValue: correlationIdService },
      ],
    }).compile();

    service = module.get<BulkheadService>(BulkheadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBulkhead', () => {
    it('should create a bulkhead', () => {
      const config: BulkheadConfig = {
        name: 'test-bulkhead',
        maxConcurrent: 5,
      };

      service.createBulkhead(config);

      expect(service.getBulkheadNames()).toContain('test-bulkhead');
    });

    it('should warn if bulkhead already exists', () => {
      const config: BulkheadConfig = {
        name: 'duplicate-bulkhead',
        maxConcurrent: 3,
      };

      service.createBulkhead(config);
      service.createBulkhead(config); // Second creation

      // Should still only have one
      const names = service.getBulkheadNames().filter((n) => n === 'duplicate-bulkhead');
      expect(names).toHaveLength(1);
    });
  });

  describe('execute', () => {
    it('should execute function within bulkhead', async () => {
      service.createBulkhead({ name: 'exec-test', maxConcurrent: 5 });

      const result = await service.execute('exec-test', async () => 'success');

      expect(result).toBe('success');
    });

    it('should execute without bulkhead when not found', async () => {
      const result = await service.execute('non-existent', async () => 'fallback');
      expect(result).toBe('fallback');
    });

    it('should track success metrics', async () => {
      service.createBulkhead({ name: 'metrics-test', maxConcurrent: 5 });

      await service.execute('metrics-test', async () => 'ok');

      const metrics = service.getMetrics('metrics-test')!;
      expect(metrics.totalSuccessful).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should track failure metrics', async () => {
      service.createBulkhead({ name: 'fail-test', maxConcurrent: 5 });

      await expect(
        service.execute('fail-test', async () => {
          throw new Error('Bulkhead operation failed');
        }),
      ).rejects.toThrow('Bulkhead operation failed');

      const metrics = service.getMetrics('fail-test')!;
      expect(metrics.totalFailed).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return undefined for non-existent bulkhead', () => {
      expect(service.getMetrics('non-existent')).toBeUndefined();
    });

    it('should return metrics for existing bulkhead', () => {
      service.createBulkhead({ name: 'metrics-bulkhead', maxConcurrent: 10 });

      const metrics = service.getMetrics('metrics-bulkhead');
      expect(metrics).toBeDefined();
      expect(metrics!.maxConcurrent).toBe(10);
      expect(metrics!.currentConcurrent).toBe(0);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all bulkhead metrics', () => {
      service.createBulkhead({ name: 'bulk-a', maxConcurrent: 3 });
      service.createBulkhead({ name: 'bulk-b', maxConcurrent: 5 });

      const allMetrics = service.getAllMetrics();
      expect(allMetrics).toHaveLength(2);
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics for a bulkhead', async () => {
      service.createBulkhead({ name: 'reset-test', maxConcurrent: 5 });

      await service.execute('reset-test', async () => 'ok');
      service.resetMetrics('reset-test');

      const metrics = service.getMetrics('reset-test')!;
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalSuccessful).toBe(0);
    });
  });

  describe('removeBulkhead', () => {
    it('should remove a bulkhead', () => {
      service.createBulkhead({ name: 'remove-test', maxConcurrent: 5 });
      service.removeBulkhead('remove-test');

      expect(service.getBulkheadNames()).not.toContain('remove-test');
      expect(service.getMetrics('remove-test')).toBeUndefined();
    });
  });
});
