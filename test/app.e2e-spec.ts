import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';




describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  describe('Auth Endpoints', () => {
    const testEmail = 'e2euser@example.com';
    const testPassword = 'e2epassword';
    let verificationToken: string;

    it('/auth/register (POST) - should register user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/Registration successful/i);
    });

    it('/auth/signin (POST) - should fail before verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(401);
    });

    it('/auth/verify (GET) - should verify email', async () => {
      // Simulate fetching token from DB (in real test, query DB or mock)
      // Here, we assume the verification token is 'token' for demo purposes
      verificationToken = 'token';
      const res = await request(app.getHttpServer())
        .get(`/auth/verify?token=${verificationToken}`);
      expect([200, 201]).toContain(res.status);
      expect(res.body.message).toMatch(/verified/i);
    });

    it('/auth/signin (POST) - should login after verification', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: testEmail, password: testPassword });
      expect(res.status).toBe(201);
      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
    });
  });
});
