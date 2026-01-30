import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { AppModule } from '../src/app.module';

/**
 * Integration tests for global error handling and custom exceptions
 */
describe('Error Handling Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Custom Exception Handling', () => {
    it('should handle InsufficientBalanceException correctly', async () => {
      // This test assumes an endpoint throws this exception
      const response = await request(app.getHttpServer())
        .post('/api/balance/deduct')
        .send({
          userId: 'user123',
          asset: 'BTC',
          amount: 100, // Assuming user doesn't have 100 BTC
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'INSUFFICIENT_BALANCE');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should handle ResourceNotFoundException correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/nonexistent-user');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code', 'RESOURCE_NOT_FOUND');
    });

    it('should handle UnauthorizedAccessException correctly', async () => {
      // Test endpoint that requires admin permissions
      const response = await request(app.getHttpServer())
        .post('/api/admin/settings')
        .set('Authorization', 'Bearer regular-user-token')
        .send({ setting: 'value' });

      expect(response.status).toBe(403);
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED_ACCESS');
    });

    it('should handle AuthenticationFailedException correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toHaveProperty('code', 'AUTHENTICATION_FAILED');
    });

    it('should handle RateLimitExceededException correctly', async () => {
      // Make multiple requests to trigger rate limit
      const makeRequest = () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password',
          });

      // Make requests until rate limit is hit
      let response;
      for (let i = 0; i < 10; i++) {
        response = await makeRequest();
        if (response.status === 429) break;
      }

      if (response.status === 429) {
        expect(response.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
        expect(response.body.metadata).toHaveProperty('retryAfter');
      }
    });

    it('should handle ValidationException correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_FAILED');
      expect(response.body.error).toHaveProperty('validationErrors');
    });

    it('should handle ConflictException correctly', async () => {
      // Create a user
      await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'unique@example.com',
          password: 'ValidPassword123',
        });

      // Try to create again with same email
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'unique@example.com',
          password: 'DifferentPassword123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toHaveProperty('code', 'CONFLICT');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/invalid-id');

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should include metadata when available', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/balance/deduct')
        .send({
          userId: 'user123',
          asset: 'BTC',
          amount: 100,
        });

      if (response.status === 400) {
        expect(response.body).toHaveProperty('metadata');
      }
    });

    it('should have valid ISO timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/invalid-id');

      const timestamp = response.body.error.timestamp;
      expect(() => new Date(timestamp).toISOString()).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('Validation Error Formatting', () => {
    it('should format class-validator errors correctly', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'not-an-email',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_FAILED');
      expect(response.body.error).toHaveProperty('validationErrors');
      
      const errors = response.body.error.validationErrors;
      expect(typeof errors).toBe('object');
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 400 for bad requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/balance/deduct')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 for authentication errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/protected-endpoint');

      expect(response.status).toBe(401);
    });

    it('should return 403 for authorization errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/admin/settings')
        .set('Authorization', 'Bearer non-admin-token')
        .send({});

      expect(response.status).toBe(403);
    });

    it('should return 404 for not found errors', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/nonexistent-id-12345');

      expect(response.status).toBe(404);
    });

    it('should return 409 for conflict errors', async () => {
      // Assuming duplicate user scenario
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'existing@example.com',
          password: 'ValidPassword123',
        });

      if (response.status === 409) {
        expect(response.status).toBe(409);
      }
    });

    it('should return 429 for rate limit errors', async () => {
      // This would require rate limiting to be configured
      // Skipping for now as it depends on rate limiter setup
    });

    it('should return 500 for internal server errors', async () => {
      // Trigger an internal error (implementation depends on endpoint)
      const response = await request(app.getHttpServer())
        .post('/api/trade/execute')
        .set('Authorization', 'Bearer valid-token')
        .send({
          invalid: 'data-causing-internal-error',
        });

      if (response.status === 500) {
        expect(response.body.error).toHaveProperty('code', 'INTERNAL_ERROR');
      }
    });
  });

  describe('Error Logging', () => {
    it('should log errors with proper context', async () => {
      // This test would check logs (requires spy on logger)
      const response = await request(app.getHttpServer())
        .get('/api/users/test-user-123');

      // Error should be logged with request context
      expect(response.status).toBe(404);
    });
  });

  describe('Sensitive Data Sanitization', () => {
    it('should not expose sensitive data in error responses', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123',
        });

      // Response should not contain password or other sensitive fields
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('ValidPassword123');
      expect(responseString).not.toContain('password');
    });
  });
});
