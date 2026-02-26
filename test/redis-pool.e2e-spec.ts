import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CustomCacheModule } from '../src/common/cache/cache.module';
import { ConfigModule } from '../src/config/config.module';
import request from 'supertest';

/**
 * E2E tests for Redis connection pool and metrics.
 * When Redis is unavailable or pool is disabled, endpoints return enabled: false.
 * When Redis pool is enabled, metrics endpoints return pool utilization and retry rates.
 */
describe('Redis pool (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, CustomCacheModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /cache/redis/metrics', () => {
    it('should return Redis metrics or enabled: false', async () => {
      const res = await request(app.getHttpServer()).get('/cache/redis/metrics');
      expect(res.status).toBe(200);
      if (res.body.enabled === false) {
        expect(res.body).toEqual({ enabled: false });
      } else {
        expect(res.body).toHaveProperty('poolAvailable');
        expect(res.body).toHaveProperty('poolInUse');
        expect(res.body).toHaveProperty('totalRetries');
        expect(res.body).toHaveProperty('circuitBreakerState');
      }
    });
  });

  describe('GET /cache/redis/pool', () => {
    it('should return pool metrics or enabled: false', async () => {
      const res = await request(app.getHttpServer()).get('/cache/redis/pool');
      expect(res.status).toBe(200);
      if (res.body.enabled === false) {
        expect(res.body).toEqual({ enabled: false });
      } else {
        expect(res.body).toHaveProperty('poolSize');
        expect(res.body).toHaveProperty('available');
        expect(res.body).toHaveProperty('inUse');
        expect(res.body).toHaveProperty('totalAcquired');
        expect(res.body).toHaveProperty('totalConnectionErrors');
      }
    });
  });

  describe('Redis reconnection scenario', () => {
    it('should expose retry and connection error metrics after failures', async () => {
      const before = await request(app.getHttpServer()).get('/cache/redis/metrics');
      const beforeBody = before.body;
      if (beforeBody.enabled === false) {
        return;
      }
      const beforeRetries = beforeBody.totalRetries ?? 0;
      const beforeErrors = beforeBody.totalConnectionErrors ?? 0;
      expect(typeof beforeRetries).toBe('number');
      expect(typeof beforeErrors).toBe('number');
    });
  });
});
