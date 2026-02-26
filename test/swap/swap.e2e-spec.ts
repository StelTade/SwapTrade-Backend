import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { VirtualAsset } from '../../src/trading/entities/virtual-asset.entity';
import { UserBalance } from '../../src/balance/entities/user-balance.entity';

describe('Swap (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let assetRepo: Repository<VirtualAsset>;
  let balanceRepo: Repository<UserBalance>;

  const userId = 1001; // Numeric ID for user
  let btcId: number;
  let ethId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    assetRepo = dataSource.getRepository(VirtualAsset);
    balanceRepo = dataSource.getRepository(UserBalance);

    // Seed assets and get IDs
    // Check if assets exist first to avoid duplicates if DB persists
    let btc = await assetRepo.findOne({ where: { symbol: 'BTC' } });
    if (!btc) {
        btc = await assetRepo.save(assetRepo.create({ symbol: 'BTC', name: 'Bitcoin', price: 50000 }));
    }
    btcId = btc.id;

    let eth = await assetRepo.findOne({ where: { symbol: 'ETH' } });
    if (!eth) {
        eth = await assetRepo.save(assetRepo.create({ symbol: 'ETH', name: 'Ethereum', price: 3000 }));
    }
    ethId = eth.id;

    // Clear user balances for this user
    await balanceRepo.delete({ userId });

    // Seed balances
    await balanceRepo.save(
      balanceRepo.create([
        { userId, assetId: btcId, balance: 5, totalInvested: 0, cumulativePnL: 0, averageBuyPrice: 0 },
        { userId, assetId: ethId, balance: 1, totalInvested: 0, cumulativePnL: 0, averageBuyPrice: 0 },
      ]),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /swap succeeds with valid request', async () => {
    const res = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, fromAssetId: btcId, toAssetId: ethId, amount: 2 })
      .expect(201);

    // 2 BTC converted to ETH. BTC price 50000, ETH price 3000.
    // 2 * 50000 = 100,000 USD
    // 100,000 / 3000 = 33.333... ETH
    const expectedEthReceived = (2 * 50000) / 3000;

    expect(res.body).toEqual({
      userId,
      fromAssetId: btcId,
      toAssetId: ethId,
      sentAmount: 2,
      receivedAmount: expectedEthReceived,
    });
    
    // Verify DB
    const btcBalance = await balanceRepo.findOne({ where: { userId, assetId: btcId } });
    const ethBalance = await balanceRepo.findOne({ where: { userId, assetId: ethId } });
    
    expect(btcBalance).toBeDefined();
    expect(ethBalance).toBeDefined();

    if (btcBalance) {
      expect(Number(btcBalance.balance)).toBe(3); // 5 - 2
    }
    if (ethBalance) {
      expect(Number(ethBalance.balance)).toBeCloseTo(1 + expectedEthReceived);
    }
  });

  it('POST /swap fails on insufficient funds', async () => {
    const response = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, fromAssetId: btcId, toAssetId: ethId, amount: 1000 })
      .expect(400);

    expect(response.body.message).toContain('Insufficient funds');
  });

  it('POST /swap fails on unsupported token (invalid ID)', async () => {
    const response = await request(app.getHttpServer())
      .post('/swap')
      .send({ userId, fromAssetId: btcId, toAssetId: 999999, amount: 1 })
      .expect(404);

    expect(response.body.message).toContain('Unsupported asset ID');
  });
});
