import { Test, TestingModule } from '@nestjs/testing';
import {
  DatabaseShardingService,
  ShardConfig,
} from '../src/database/services/database-sharding.service';
import { Trade } from '../src/database/entities/trade.entity';
import * as fs from 'fs';

describe('DatabaseShardingService', () => {
  let service: DatabaseShardingService;
  const dbPath1 = 'test_shard1.db';
  const dbPath2 = 'test_shard2.db';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseShardingService],
    }).compile();

    service = module.get<DatabaseShardingService>(DatabaseShardingService);

    const shardConfigs: ShardConfig[] = [
      {
        id: 'shard1',
        host: 'localhost',
        port: 5432,
        database: dbPath1,
        username: 'admin',
        password: 'password',
        weight: 1,
        isPrimary: true,
      },
      {
        id: 'shard2',
        host: 'localhost',
        port: 5432,
        database: dbPath2,
        username: 'admin',
        password: 'password',
        weight: 1,
        isPrimary: true,
      },
    ];

    // Clean up old test DBs
    if (fs.existsSync(dbPath1)) fs.unlinkSync(dbPath1);
    if (fs.existsSync(dbPath2)) fs.unlinkSync(dbPath2);

    await service.initializeShards(shardConfigs);
  });

  afterAll(() => {
    if (fs.existsSync(dbPath1)) fs.unlinkSync(dbPath1);
    if (fs.existsSync(dbPath2)) fs.unlinkSync(dbPath2);
    if (fs.existsSync('test_shard3.db')) fs.unlinkSync('test_shard3.db');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should insert data into correct shards using consistent hashing', async () => {
    const trade1 = {
      userId: 'user1',
      asset: 'BTC',
      type: 'BUY',
      amount: 1,
      price: 50000,
      timestamp: new Date(),
    };
    const trade2 = {
      userId: 'user2',
      asset: 'ETH',
      type: 'SELL',
      amount: 10,
      price: 3000,
      timestamp: new Date(),
    };

    await service.insert(Trade, trade1);
    await service.insert(Trade, trade2);

    const health = await service.getShardHealth();
    const totalTrades = Object.values(health).reduce(
      (sum: number, h: any) => sum + (h.tradeCount || 0),
      0,
    );

    expect(totalTrades).toBe(2);
  });

  it('should execute queries across shards', async () => {
    await service.insert(Trade, {
      userId: 'user1',
      asset: 'BTC',
      type: 'BUY',
      amount: 1,
      price: 50000,
      timestamp: new Date(),
    });
    await service.insert(Trade, {
      userId: 'user2',
      asset: 'ETH',
      type: 'SELL',
      amount: 10,
      price: 3000,
      timestamp: new Date(),
    });

    const queryPlan = service.createQueryPlan('user');
    const results = await service.executeQueryAcrossShards(
      Trade,
      queryPlan,
      async (repo) => {
        return await repo.find();
      },
    );

    expect(results.length).toBe(2);
  });

  it('should provision a new shard dynamically', async () => {
    const dbPath3 = 'test_shard3.db';
    if (fs.existsSync(dbPath3)) fs.unlinkSync(dbPath3);

    const newConfig: ShardConfig = {
      id: 'shard3',
      host: 'localhost',
      port: 5432,
      database: dbPath3,
      username: 'admin',
      password: 'password',
      weight: 1,
      isPrimary: true,
    };

    await service.provisionNewShard(newConfig);
    const health = await service.getShardHealth();
    expect(health['shard3']).toBeDefined();
  });

  it('should rebalance shards', async () => {
    // Insert some data
    await service.insert(Trade, {
      userId: 'user1',
      asset: 'BTC',
      type: 'BUY',
      amount: 1,
      price: 50000,
      timestamp: new Date(),
    });
    await service.insert(Trade, {
      userId: 'user2',
      asset: 'ETH',
      type: 'SELL',
      amount: 10,
      price: 3000,
      timestamp: new Date(),
    });

    // Force a rebalance
    await service.rebalanceShards();

    const health = await service.getShardHealth();
    const totalTrades = Object.values(health).reduce(
      (sum: number, h: any) => sum + (h.tradeCount || 0),
      0,
    );
    expect(totalTrades).toBe(2);
  });

  it('should execute cross-shard transactions', async () => {
    const trade1 = {
      userId: 'user1',
      asset: 'BTC',
      type: 'BUY',
      amount: 1,
      price: 50000,
      timestamp: new Date(),
    };
    const trade2 = {
      userId: 'user2',
      asset: 'ETH',
      type: 'SELL',
      amount: 10,
      price: 3000,
      timestamp: new Date(),
    };

    await service.executeTransaction([
      { entityClass: Trade, data: trade1, type: 'insert' },
      { entityClass: Trade, data: trade2, type: 'insert' },
    ]);

    const results = await service.executeQueryAcrossShards(
      Trade,
      service.createQueryPlan('user'),
      async (repo) => {
        return await repo.find();
      },
    );

    expect(results.length).toBe(2);
  });

  it('should rollback cross-shard transactions on failure', async () => {
    const trade1 = {
      userId: 'user1',
      asset: 'BTC',
      type: 'BUY',
      amount: 1,
      price: 50000,
      timestamp: new Date(),
    };
    // invalid data to cause failure
    const invalidTrade = {
      userId: 'user2',
      asset: 'ETH',
      type: null,
      amount: 10,
      price: 3000,
      timestamp: new Date(),
    };

    try {
      await service.executeTransaction([
        { entityClass: Trade, data: trade1, type: 'insert' },
        { entityClass: Trade, data: invalidTrade, type: 'insert' },
      ]);
      fail('Transaction should have failed');
    } catch (error) {
      expect(error).toBeDefined();
    }

    const results = await service.executeQueryAcrossShards(
      Trade,
      service.createQueryPlan('user'),
      async (repo) => {
        return await repo.find();
      },
    );

    expect(results.length).toBe(0);
  });
});
