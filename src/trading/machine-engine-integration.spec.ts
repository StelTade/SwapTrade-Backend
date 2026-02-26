import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Trade, TradeStatus } from './entities/trade.entity';
import { MatchingEngineService } from './machine-engine.service';

describe('MatchingEngineService Integration Tests', () => {
  let service: MatchingEngineService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USER || 'test',
          password: process.env.DB_PASS || 'test',
          database: process.env.DB_NAME || 'trading_test',
          entities: [Trade],
          synchronize: true,
          dropSchema: true, // Clean slate for tests
        }),
        TypeOrmModule.forFeature([Trade]),
      ],
      providers: [MatchingEngineService],
    }).compile();

    service = module.get<MatchingEngineService>(MatchingEngineService);
    dataSource = module.get<DataSource>(DataSource);

    // Setup test database tables
    await setupTestDatabase(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Clear all data before each test
    await dataSource.query('TRUNCATE TABLE trades, orders, balances CASCADE');
  });

  describe('Real Database Transaction Tests', () => {
    it('should execute a complete trade with real database transactions', async () => {
      // Setup initial balances
      await createBalance(dataSource, 'buyer1', 'USD', 60000);
      await createBalance(dataSource, 'seller1', 'BTC', 2.0);

      // Create orders
      const bidId = await createOrder(dataSource, {
        userId: 'buyer1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'BID',
      });

      const askId = await createOrder(dataSource, {
        userId: 'seller1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'ASK',
      });

      const bids = [
        {
          id: bidId,
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: askId,
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(1);

      // Verify balances
      const buyerUSD = await getBalance(dataSource, 'buyer1', 'USD');
      const buyerBTC = await getBalance(dataSource, 'buyer1', 'BTC');
      const sellerUSD = await getBalance(dataSource, 'seller1', 'USD');
      const sellerBTC = await getBalance(dataSource, 'seller1', 'BTC');

      expect(buyerUSD).toBe(10000); // 60000 - 50000
      expect(buyerBTC).toBe(1.0);
      expect(sellerUSD).toBe(50000);
      expect(sellerBTC).toBe(1.0); // 2.0 - 1.0

      // Verify trade record
      const trades = await dataSource.getRepository(Trade).find();
      expect(trades).toHaveLength(1);
      expect(trades[0].status).toBe(TradeStatus.EXECUTED);
      expect(trades[0].amount).toBe(1.0);
      expect(trades[0].price).toBe(50000);
    });

    it('should rollback transaction on insufficient buyer balance', async () => {
      await createBalance(dataSource, 'buyer1', 'USD', 10000); // Insufficient
      await createBalance(dataSource, 'seller1', 'BTC', 2.0);

      const bidId = await createOrder(dataSource, {
        userId: 'buyer1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'BID',
      });

      const askId = await createOrder(dataSource, {
        userId: 'seller1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'ASK',
      });

      const bids = [
        {
          id: bidId,
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: askId,
          userId: 'seller1',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date(),
          type: 'ASK' as const,
        },
      ];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(0);
      expect(result.failedMatches).toBe(1);

      // Verify balances unchanged
      const buyerUSD = await getBalance(dataSource, 'buyer1', 'USD');
      const sellerBTC = await getBalance(dataSource, 'seller1', 'BTC');

      expect(buyerUSD).toBe(10000);
      expect(sellerBTC).toBe(2.0);

      // Verify no trade records
      const trades = await dataSource.getRepository(Trade).find();
      expect(trades).toHaveLength(0);
    });

    it('should handle multiple trades in sequence', async () => {
      // Setup balances
      await createBalance(dataSource, 'buyer1', 'USD', 100000);
      await createBalance(dataSource, 'buyer2', 'USD', 100000);
      await createBalance(dataSource, 'seller1', 'BTC', 5.0);

      const bid1 = await createOrder(dataSource, {
        userId: 'buyer1',
        asset: 'BTC',
        amount: 1.0,
        price: 51000,
        type: 'BID',
      });

      const bid2 = await createOrder(dataSource, {
        userId: 'buyer2',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'BID',
      });

      const ask1 = await createOrder(dataSource, {
        userId: 'seller1',
        asset: 'BTC',
        amount: 2.0,
        price: 49000,
        type: 'ASK',
      });

      const bids = [
        {
          id: bid1,
          userId: 'buyer1',
          asset: 'BTC',
          amount: 1.0,
          price: 51000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'BID' as const,
        },
        {
          id: bid2,
          userId: 'buyer2',
          asset: 'BTC',
          amount: 1.0,
          price: 50000,
          remainingAmount: 1.0,
          timestamp: new Date('2024-01-01T10:01:00Z'),
          type: 'BID' as const,
        },
      ];

      const asks = [
        {
          id: ask1,
          userId: 'seller1',
          asset: 'BTC',
          amount: 2.0,
          price: 49000,
          remainingAmount: 2.0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'ASK' as const,
        },
      ];

      const result = await service.matchTrades(bids, asks);

      expect(result.tradesExecuted).toBe(2);

      // Verify 2 trades created
      const trades = await dataSource.getRepository(Trade).find({
        order: { timestamp: 'ASC' },
      });
      expect(trades).toHaveLength(2);

      // First trade should be buyer1 at 49000 (ask price)
      expect(trades[0].buyerId).toBe('buyer1');
      expect(trades[0].price).toBe(49000);

      // Second trade should be buyer2 at 49000 (ask price)
      expect(trades[1].buyerId).toBe('buyer2');
      expect(trades[1].price).toBe(49000);
    });

    it('should handle concurrent matching attempts safely', async () => {
      await createBalance(dataSource, 'buyer1', 'USD', 100000);
      await createBalance(dataSource, 'buyer2', 'USD', 100000);
      await createBalance(dataSource, 'seller1', 'BTC', 1.0);

      const bidId1 = await createOrder(dataSource, {
        userId: 'buyer1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'BID',
      });

      const bidId2 = await createOrder(dataSource, {
        userId: 'buyer2',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'BID',
      });

      const askId = await createOrder(dataSource, {
        userId: 'seller1',
        asset: 'BTC',
        amount: 1.0,
        price: 50000,
        type: 'ASK',
      });

      const orders = {
        bids: [
          {
            id: bidId1,
            userId: 'buyer1',
            asset: 'BTC',
            amount: 1.0,
            price: 50000,
            remainingAmount: 1.0,
            timestamp: new Date(),
            type: 'BID' as const,
          },
          {
            id: bidId2,
            userId: 'buyer2',
            asset: 'BTC',
            amount: 1.0,
            price: 50000,
            remainingAmount: 1.0,
            timestamp: new Date(),
            type: 'BID' as const,
          },
        ],
        asks: [
          {
            id: askId,
            userId: 'seller1',
            asset: 'BTC',
            amount: 1.0,
            price: 50000,
            remainingAmount: 1.0,
            timestamp: new Date(),
            type: 'ASK' as const,
          },
        ],
      };

      // Run matching twice concurrently
      const [result1, result2] = await Promise.all([
        service.matchTrades(orders.bids, orders.asks),
        service.matchTrades(orders.bids, orders.asks),
      ]);

      // One should succeed, one should fail (or both partial)
      const totalTrades = result1.tradesExecuted + result2.tradesExecuted;
      expect(totalTrades).toBeLessThanOrEqual(1); // Can't execute more than available

      const sellerBTC = await getBalance(dataSource, 'seller1', 'BTC');
      expect(sellerBTC).toBeGreaterThanOrEqual(0); // No negative balance
    });
  });
});

// Helper functions
async function setupTestDatabase(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS balances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      asset VARCHAR(50) NOT NULL,
      amount DECIMAL(20, 8) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, asset)
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      asset VARCHAR(50) NOT NULL,
      amount DECIMAL(20, 8) NOT NULL,
      remaining_amount DECIMAL(20, 8) NOT NULL,
      price DECIMAL(20, 8) NOT NULL,
      type VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function createBalance(
  dataSource: DataSource,
  userId: string,
  asset: string,
  amount: number,
) {
  await dataSource.query(
    `INSERT INTO balances (user_id, asset, amount) VALUES ($1, $2, $3)`,
    [userId, asset, amount],
  );
}

async function getBalance(
  dataSource: DataSource,
  userId: string,
  asset: string,
): Promise<number> {
  const result = await dataSource.query(
    `SELECT amount FROM balances WHERE user_id = $1 AND asset = $2`,
    [userId, asset],
  );
  return result[0]?.amount || 0;
}

async function createOrder(
  dataSource: DataSource,
  order: {
    userId: string;
    asset: string;
    amount: number;
    price: number;
    type: string;
  },
): Promise<string> {
  const result = await dataSource.query(
    `INSERT INTO orders (user_id, asset, amount, remaining_amount, price, type) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      order.userId,
      order.asset,
      order.amount,
      order.amount,
      order.price,
      order.type,
    ],
  );
  return result[0].id;
}
