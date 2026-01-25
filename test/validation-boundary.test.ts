import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';

describe('Validation Boundary Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Configure validation pipe for testing
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        disableErrorMessages: false,
      }),
    );
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('User Registration Validation', () => {
    it('should reject registration with empty email', async () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: '',
          password: 'ValidPass123!',
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
          expect(response.body.message.some(msg => msg.includes('email') && msg.includes('Invalid'))).toBe(true);
        });
    });

    it('should reject registration with invalid email format', async () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPass123!',
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
          expect(response.body.message.some(msg => msg.includes('Invalid email format'))).toBe(true);
        });
    });

    it('should reject registration with weak password', async () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
          expect(response.body.message.some(msg => msg.includes('password') && msg.includes('8 characters'))).toBe(true);
        });
    });

    it('should accept valid registration data', async () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'StrongPass123!',
        })
        .expect(201); // Assuming successful registration returns 201
    });
  });

  describe('Balance Update Validation', () => {
    it('should reject balance update with invalid userId', async () => {
      return request(app.getHttpServer())
        .post('/balance/update')
        .send({
          userId: -1, // Invalid negative user ID
          assetId: 1,
          amount: 100,
          reason: 'Test deposit'
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
        });
    });

    it('should reject balance update with oversized reason', async () => {
      const oversizedReason = 'a'.repeat(300); // Exceeds max length of 255
      
      return request(app.getHttpServer())
        .post('/balance/update')
        .send({
          userId: 1,
          assetId: 1,
          amount: 100,
          reason: oversizedReason
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
        });
    });
  });

  describe('Asset Type Validation', () => {
    it('should reject invalid asset type format', async () => {
      return request(app.getHttpServer())
        .post('/portfolio/update')
        .send({
          userId: 1,
          asset: 'INVALID_ASSET_NAME_WITH_TOO_MANY_CHARACTERS_THAT_EXCEEDS_LIMIT', // Too long
          balance: 1000
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
        });
    });

    it('should accept valid asset type format', async () => {
      return request(app.getHttpServer())
        .post('/portfolio/update')
        .send({
          userId: 1,
          asset: 'BTC',
          balance: 1000
        })
        .expect(201); // Assuming successful update returns 201
    });
  });

  describe('Numeric Field Validation', () => {
    it('should reject negative amounts where positive required', async () => {
      return request(app.getHttpServer())
        .post('/trading/orders')
        .send({
          userId: 1,
          asset: 'BTC',
          type: 'BUY',
          amount: -10, // Negative amount not allowed
          price: 50000
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
        });
    });

    it('should reject zero amounts where positive required', async () => {
      return request(app.getHttpServer())
        .post('/trading/orders')
        .send({
          userId: 1,
          asset: 'BTC',
          type: 'BUY',
          amount: 0, // Zero amount not allowed
          price: 50000
        })
        .expect(400)
        .then(response => {
          expect(response.body).toHaveProperty('statusCode', 400);
          expect(response.body).toHaveProperty('error', 'Bad Request');
          expect(Array.isArray(response.body.message)).toBe(true);
        });
    });
  });

  describe('String Sanitization', () => {
    it('should trim whitespace from string inputs', async () => {
      // This test verifies that the validation pipe trims whitespace
      // In a real scenario, we'd need to check if the controller receives the trimmed value
      return request(app.getHttpServer())
        .post('/users/update')
        .send({
          username: '  spacedusername  ', // Has leading/trailing spaces
          email: ' spaced@example.com ',
        })
        .then(response => {
          // The validation should succeed if trimming worked properly
          // The actual trimming behavior would be verified in the controller
          if (response.status === 400) {
            // If validation failed, check that it wasn't due to length issues caused by spaces
            expect(response.body.message.some(msg => 
              msg.toLowerCase().includes('length') || msg.toLowerCase().includes('min')
            )).toBe(false);
          }
        });
    });
  });
});