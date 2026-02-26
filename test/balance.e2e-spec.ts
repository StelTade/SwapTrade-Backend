import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { UserBalance } from '../src/balance/entities/user-balance.entity';
import { VirtualAsset } from '../src/trading/entities/virtual-asset.entity';

describe('BalanceController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let balanceRepo: Repository<UserBalance>;
  let assetRepo: Repository<VirtualAsset>;
  
  const userId = 1002;
  let btcId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    balanceRepo = dataSource.getRepository(UserBalance);
    assetRepo = dataSource.getRepository(VirtualAsset);

    // Seed Asset
    let btc = await assetRepo.findOne({ where: { symbol: 'BTC' } });
    if (!btc) {
        btc = await assetRepo.save(assetRepo.create({ symbol: 'BTC', name: 'Bitcoin', price: 50000 }));
    }
    btcId = btc.id;

    // Clear balances for user
    await balanceRepo.delete({ userId });

    // Seed Balance
    await balanceRepo.save(
        balanceRepo.create({ userId, assetId: btcId, balance: 10, totalInvested: 10, cumulativePnL: 0, averageBuyPrice: 50000 })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('/balances/:userId (GET) returns user balances', async () => {
    const res = await request(app.getHttpServer())
      .get(`/balances/${userId}`)
      .expect(200);
    
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        asset: 'BTC',
        balance: 10,
        assetId: btcId
      })
    ]));
  });

  it('/balances/deposit (POST) increases balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/balances/deposit')
      .send({ userId, assetId: btcId, amount: 5 })
      .expect(201);
    
    expect(Number(res.body.balance)).toBe(15);

    const balance = await balanceRepo.findOne({ where: { userId, assetId: btcId } });
    expect(balance).toBeDefined();
    if (balance) {
      expect(Number(balance.balance)).toBe(15);
    }
  });

  it('/balances/withdraw (POST) decreases balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/balances/withdraw')
      .send({ userId, assetId: btcId, amount: 2 })
      .expect(201);
    
    expect(Number(res.body.balance)).toBe(13); // 15 - 2

    const balance = await balanceRepo.findOne({ where: { userId, assetId: btcId } });
    expect(balance).not.toBeNull();
    if (balance) {
      expect(Number(balance.balance)).toBe(13);
    }
  });

  it('/balances/withdraw (POST) fails on insufficient funds', async () => {
    await request(app.getHttpServer())
      .post('/balances/withdraw')
      .send({ userId, assetId: btcId, amount: 100 })
      .expect(400); 
  });
});
