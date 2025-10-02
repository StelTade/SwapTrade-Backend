import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { VirtualAsset } from '../src/trading/entities/virtual-asset.entity';
import { Balance } from '../src/balance/balance.entity';

describe('Swap (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let assetRepo: Repository<VirtualAsset>;
  let balanceRepo: Repository<Balance>;

  const userId = 'user-e2e-1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    assetRepo = dataSource.getRepository(VirtualAsset);
    balanceRepo = dataSource.getRepository(Balance);

    // seed assets
    await assetRepo.save(
      assetRepo.create([
        { symbol: 'BTC', name: 'Bitcoin' },
        { symbol: 'ETH', name: 'Ethereum' },
      ]),
    );

    // clear user balances for this user
    await balanceRepo.delete({ userId });

    // seed balances
    await balanceRepo.save(
      balanceRepo.create([
        { userId, asset: 'BTC', balance: 5 },
        { userId, asset: 'ETH', balance: 1 },
      ]),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /swap succeeds with valid request', async () => {
    const res = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, from: 'BTC', to: 'ETH', amount: 2 })
      .expect(201);

    expect(res.body).toEqual({
      userId,
      from: { asset: 'BTC', balance: 3 },
      to: { asset: 'ETH', balance: 3 },
    });
  });

  it('POST /swap fails on insufficient funds', async () => {
    const response = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, from: 'BTC', to: 'ETH', amount: 1000 })
      .expect(400);

    expect(response.body.message).toContain('Insufficient funds');
  });

  it('POST /swap fails on unsupported token', async () => {
    const response = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, from: 'BTC', to: 'ABC', amount: 1 })
      .expect(404);

    expect(response.body.message).toContain('Unsupported token');
  });
});
