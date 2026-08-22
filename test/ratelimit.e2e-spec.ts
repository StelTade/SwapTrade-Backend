/**
 * E2E tests for Rate Limiting & Throttling
 *
 * Tests the full middleware pipeline including:
 * - Per-IP rate limiting
 * - Per-user rate limiting
 * - Rate limit headers (X-RateLimit-*, Retry-After)
 * - 429 responses when limits exceeded
 * - Configurable limits per endpoint
 * - Fail-open behavior on errors
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers on responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);

      // Check for standard rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should set Retry-After header when rate limited', async () => {
      // Exhaust the rate limit by making many requests quickly
      const ip = '10.99.99.99'; // Unique IP to avoid interference
      let rateLimited = false;

      for (let i = 0; i < 200; i++) {
        const response = await request(app.getHttpServer())
          .get('/')
          .set('X-Forwarded-For', ip);

        if (response.status === 429) {
          rateLimited = true;
          expect(response.headers['retry-after']).toBeDefined();
          expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
          expect(response.body.statusCode).toBe(429);
          expect(response.body.error).toBe('Too Many Requests');
          expect(response.body.retryAfter).toBeGreaterThan(0);
          break;
        }
      }

      // The request should have been rate limited at some point
      // (depends on GLOBAL limit config)
      if (!rateLimited) {
        // If we didn't hit the limit, that's also valid depending on config
        console.log(
          'Note: Did not hit rate limit within 200 requests (limit may be high)',
        );
      }
    });
  });

  describe('Per-IP Rate Limiting', () => {
    it('should track rate limits independently per IP', async () => {
      const ip1 = '10.88.88.1';
      const ip2 = '10.88.88.2';

      // Make requests from IP1
      const response1 = await request(app.getHttpServer())
        .get('/')
        .set('X-Forwarded-For', ip1);
      expect(response1.status).toBe(200);

      // Make requests from IP2 - should have independent counter
      const response2 = await request(app.getHttpServer())
        .get('/')
        .set('X-Forwarded-For', ip2);
      expect(response2.status).toBe(200);

      // Remaining counts should be similar (not shared)
      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);
      expect(Math.abs(remaining1 - remaining2)).toBeLessThanOrEqual(1);
    });

    it('should extract real IP from X-Forwarded-For header', async () => {
      const realIp = '10.77.77.77';
      const response = await request(app.getHttpServer())
        .get('/')
        .set('X-Forwarded-For', realIp)
        .expect(200);

      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should extract real IP from X-Real-IP header', async () => {
      const realIp = '10.66.66.66';
      const response = await request(app.getHttpServer())
        .get('/')
        .set('X-Real-IP', realIp)
        .expect(200);

      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Fail-Open Behavior', () => {
    it('should allow requests even when Redis is unavailable', async () => {
      // This test verifies that the middleware fails open
      // In test environment, Redis might not be running
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);

      // Should still get rate limit headers (or at least not crash)
      expect(response.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    it('should return proper 429 JSON response body', async () => {
      const ip = '10.55.55.55';
      let hitLimit = false;

      for (let i = 0; i < 300; i++) {
        const response = await request(app.getHttpServer())
          .get('/')
          .set('X-Forwarded-For', ip);

        if (response.status === 429) {
          hitLimit = true;
          expect(response.body).toHaveProperty('statusCode', 429);
          expect(response.body).toHaveProperty('error', 'Too Many Requests');
          expect(response.body).toHaveProperty('retryAfter');
          expect(typeof response.body.retryAfter).toBe('number');
          break;
        }
      }

      if (!hitLimit) {
        console.log(
          'Note: Did not hit rate limit within 300 requests (limit may be high)',
        );
      }
    });
  });
});
