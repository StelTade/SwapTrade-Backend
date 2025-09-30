import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('BalanceController (e2e)', () => {
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

  it('/balances/user1 (GET) returns user1 balances', async () => {
    const res = await request(app.getHttpServer())
      .get('/balances/user1')
      .expect(200);
    expect(res.body).toEqual([
      { asset: 'BTC', balance: 0.5 },
      { asset: 'ETH', balance: 10 },
    ]);
  });

  it('/balances/userX (GET) returns empty list for unknown user', async () => {
    const res = await request(app.getHttpServer())
      .get('/balances/userX')
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
