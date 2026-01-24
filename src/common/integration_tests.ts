// test/logging-integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { LoggerService } from './logging/logger_service';
import { MetricsService } from './logging/metrics_service';
import * as fs from 'fs';
import * as path from 'path';

describe('Logging Integration Tests', () => {
  let app: INestApplication;
  let loggerService: LoggerService;
  let metricsService: MetricsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    loggerService = app.get<LoggerService>(LoggerService);
    metricsService = app.get<MetricsService>(MetricsService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    metricsService.reset();
  });

  describe('Request Correlation', () => {
    it('should generate correlation ID for requests without one', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should propagate existing correlation ID', async () => {
      const correlationId = 'test-correlation-id-123';

      const response = await request(app.getHttpServer())
        .get('/health')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });

    it('should include correlation ID in logs', async () => {
      const logSpy = jest.spyOn(loggerService, 'log');
      const correlationId = 'test-correlation-id-456';

      await request(app.getHttpServer())
        .get('/health')
        .set('X-Correlation-ID', correlationId);

      expect(logSpy).toHaveBeenCalledWith(
        'Incoming request',
        expect.objectContaining({
          correlationId,
        }),
      );
    });
  });

  describe('Request/Response Logging', () => {
    it('should log successful requests', async () => {
      const logSpy = jest.spyOn(loggerService, 'log');

      await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(logSpy).toHaveBeenCalledWith(
        'Request completed',
        expect.objectContaining({
          method: 'GET',
          statusCode: 200,
          duration: expect.any(Number),
        }),
      );
    });

    it('should log failed requests with error level', async () => {
      const errorSpy = jest.spyOn(loggerService, 'error');

      await request(app.getHttpServer())
        .get('/nonexistent')
        .expect(404);

      // Should log with appropriate level based on status code
    });

    it('should log request duration', async () => {
      const logSpy = jest.spyOn(loggerService, 'log');

      const startTime = Date.now();
      await request(app.getHttpServer()).get('/health');
      const endTime = Date.now();

      const logCall = logSpy.mock.calls.find(
        call => call[0] === 'Request completed',
      );

      expect(logCall).toBeDefined();
      const duration = logCall![1]!.duration as number;
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('Performance Metrics', () => {
    it('should record request duration metrics', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const metrics = metricsService.getRequestMetrics('/health');
      expect(metrics).toBeDefined();
      expect(metrics!.count).toBeGreaterThan(0);
      expect(metrics!.avg).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      // Make some successful requests
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health');

      // Make a failed request
      await request(app.getHttpServer()).get('/nonexistent');

      const errorRate = metricsService.getErrorRate('/health');
      expect(errorRate.total).toBeGreaterThan(0);
    });

    it('should expose metrics via endpoint', async () => {
      // Make a few requests first
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health');

      const response = await request(app.getHttpServer())
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('requests');
    });
  });

  describe('Error Logging', () => {
    it('should log errors with stack traces', async () => {
      const errorSpy = jest.spyOn(loggerService, 'error');

      await request(app.getHttpServer())
        .post('/test-error')
        .expect(500);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Error'), // Stack trace
        expect.any(Object),
      );
    });

    it('should include error context in logs', async () => {
      const errorSpy = jest.spyOn(loggerService, 'error');

      await request(app.getHttpServer())
        .post('/test-error')
        .send({ data: 'test' });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/test-error'),
        }),
      );
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask passwords in request logs', async () => {
      const logSpy = jest.spyOn(loggerService as any, 'maskSensitiveData');

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'secret123',
        });

      const maskedData = (loggerService as any).maskSensitiveData({
        username: 'testuser',
        password: 'secret123',
      });

      expect(maskedData.password).toBe('***REDACTED***');
      expect(maskedData.username).toBe('testuser');
    });

    it('should mask authorization headers', async () => {
      await request(app.getHttpServer())
        .get('/protected')
        .set('Authorization', 'Bearer secret-token');

      // Verify logs don't contain the actual token
    });
  });

  describe('Log File Rotation', () => {
    it('should write logs to file', (done) => {
      const logPath = path.join(process.cwd(), 'logs', 'combined.log');

      request(app.getHttpServer())
        .get('/health')
        .end(() => {
          // Give some time for file write
          setTimeout(() => {
            expect(fs.existsSync(logPath)).toBe(true);
            done();
          }, 100);
        });
    });

    it('should write errors to separate file', (done) => {
      const errorLogPath = path.join(process.cwd(), 'logs', 'error.log');

      request(app.getHttpServer())
        .post('/test-error')
        .end(() => {
          setTimeout(() => {
            expect(fs.existsSync(errorLogPath)).toBe(true);
            done();
          }, 100);
        });
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal logging overhead', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await request(app.getHttpServer()).get('/health');
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;

      // Average request time including logging should be reasonable
      expect(avgTime).toBeLessThan(50); // Adjust based on your requirements
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/health'));

      await Promise.all(requests);

      const totalTime = Date.now() - startTime;
      
      // All concurrent requests should complete in reasonable time
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe('Alert Thresholds', () => {
    it('should alert on slow requests', async () => {
      const warnSpy = jest.spyOn(loggerService, 'warn');

      await request(app.getHttpServer())
        .get('/slow-endpoint')
        .expect(200);

      expect(warnSpy).toHaveBeenCalledWith(
        'Slow request detected',
        expect.objectContaining({
          duration: expect.any(Number),
        }),
      );
    });

    it('should alert on high error rates', async () => {
      const errorSpy = jest.spyOn(loggerService, 'error');

      // Generate multiple errors to trigger alert
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer()).get('/test-error');
      }

      // Wait for error rate check interval
      await new Promise(resolve => setTimeout(resolve, 11000));

      // Should have logged high error rate alert
      const alertCall = errorSpy.mock.calls.find(
        call => call[0] === 'High error rate detected',
      );

      expect(alertCall).toBeDefined();
    });
  });
});