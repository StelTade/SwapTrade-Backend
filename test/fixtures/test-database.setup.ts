/**
 * Test Database Setup Utilities
 * Provides functions to initialize, clean, and seed test database
 */

import { DataSource, Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { UserBalance } from '../../src/balance/user-balance.entity';
import { OrderBook } from '../../src/trading/entities/order-book.entity';
import { Trade } from '../../src/trading/entities/trade.entity';
import { Notification } from '../../src/notification/entities/notification.entity';
import { VirtualAsset } from '../../src/trading/entities/virtual-asset.entity';

/**
 * Initialize test database with fresh connection
 */
export async function initializeTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
}

/**
 * Clean all test data from database
 */
export async function cleanTestDatabase(dataSource: DataSource): Promise<void> {
  const entities = [
    'notification',
    'trade',
    'order_book',
    'user_balance',
    'user',
    'virtual_asset',
  ];

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity);
    await repository.query(`DELETE FROM ${entity}`);
  }
}

/**
 * Reset auto-increment IDs (SQLite specific)
 */
export async function resetAutoIncrement(
  dataSource: DataSource,
): Promise<void> {
  const tables = [
    'user',
    'virtual_asset',
    'user_balance',
    'order_book',
    'trade',
    'notification',
  ];

  for (const table of tables) {
    try {
      await dataSource.query(
        `DELETE FROM sqlite_sequence WHERE name = '${table}'`,
      );
    } catch (error) {
      // Ignore if table doesn't exist or sequence doesn't exist
    }
  }
}

/**
 * Create test virtual assets (BTC, ETH, USD)
 */
export async function seedVirtualAssets(
  dataSource: DataSource,
): Promise<VirtualAsset[]> {
  const assetRepo = dataSource.getRepository(VirtualAsset);

  const assets = [
    { name: 'BTC', symbol: 'BTC', initialPrice: 45000 },
    { name: 'ETH', symbol: 'ETH', initialPrice: 2500 },
    { name: 'USD', symbol: 'USD', initialPrice: 1 },
  ];

  const createdAssets: VirtualAsset[] = [];
  for (const asset of assets) {
    const existing = await assetRepo.findOne({
      where: { symbol: asset.symbol },
    });
    if (!existing) {
      const created = assetRepo.create(asset);
      await assetRepo.save(created);
      createdAssets.push(created);
    } else {
      createdAssets.push(existing);
    }
  }

  return createdAssets;
}

/**
 * Truncate and reinitialize database
 */
export async function resetTestDatabase(dataSource: DataSource): Promise<void> {
  await cleanTestDatabase(dataSource);
  await resetAutoIncrement(dataSource);
}

/**
 * Get repository instances for testing
 */
export interface TestRepositories {
  user: Repository<User>;
  userBalance: Repository<UserBalance>;
  orderBook: Repository<OrderBook>;
  trade: Repository<Trade>;
  notification: Repository<Notification>;
  virtualAsset: Repository<VirtualAsset>;
}

export function getTestRepositories(dataSource: DataSource): TestRepositories {
  return {
    user: dataSource.getRepository(User),
    userBalance: dataSource.getRepository(UserBalance),
    orderBook: dataSource.getRepository(OrderBook),
    trade: dataSource.getRepository(Trade),
    notification: dataSource.getRepository(Notification),
    virtualAsset: dataSource.getRepository(VirtualAsset),
  };
}
