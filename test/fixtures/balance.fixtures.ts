/**
 * Test Balance Fixtures
 * Utilities for creating and managing test balances
 */

import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { UserBalance } from '../../src/balance/user-balance.entity';
import { VirtualAsset } from '../../src/trading/entities/virtual-asset.entity';

export interface BalanceSeed {
  userId: number;
  assetId: string;
  amount: number;
}

/**
 * Default test balances
 */
export const DEFAULT_TEST_BALANCES = {
  usd: 10000, // $10,000 USD for trading
  btc: 0.5, // 0.5 BTC
  eth: 5, // 5 ETH
};

/**
 * Seed user balance with specified amounts
 */
export async function seedUserBalance(
  userBalanceRepo: Repository<UserBalance>,
  virtualAssetRepo: Repository<VirtualAsset>,
  user: User,
  assetSymbol: string,
  amount: number,
): Promise<UserBalance> {
  const asset = await virtualAssetRepo.findOne({
    where: { symbol: assetSymbol },
  });

  if (!asset) {
    throw new Error(`Asset ${assetSymbol} not found`);
  }

  let balance = await userBalanceRepo.findOne({
    where: {
      userId: user.id.toString(),
      assetId: asset.id,
    },
  });

  if (!balance) {
    balance = userBalanceRepo.create({
      userId: user.id.toString(),
      assetId: asset.id,
      amount: amount,
      totalTrades: 0,
      cumulativePnL: 0,
      totalTradeVolume: 0,
    });
  } else {
    balance.amount = amount;
  }

  await userBalanceRepo.save(balance);
  return balance;
}

/**
 * Seed default balances for test user (USD, BTC, ETH)
 */
export async function seedDefaultUserBalances(
  userBalanceRepo: Repository<UserBalance>,
  virtualAssetRepo: Repository<VirtualAsset>,
  user: User,
): Promise<UserBalance[]> {
  const balances: UserBalance[] = [];

  // Seed USD balance (primary trading currency)
  const usdBalance = await seedUserBalance(
    userBalanceRepo,
    virtualAssetRepo,
    user,
    'USD',
    DEFAULT_TEST_BALANCES.usd,
  );
  balances.push(usdBalance);

  // Seed BTC balance
  const btcBalance = await seedUserBalance(
    userBalanceRepo,
    virtualAssetRepo,
    user,
    'BTC',
    DEFAULT_TEST_BALANCES.btc,
  );
  balances.push(btcBalance);

  // Seed ETH balance
  const ethBalance = await seedUserBalance(
    userBalanceRepo,
    virtualAssetRepo,
    user,
    'ETH',
    DEFAULT_TEST_BALANCES.eth,
  );
  balances.push(ethBalance);

  return balances;
}

/**
 * Get user balance for asset
 */
export async function getUserBalance(
  userBalanceRepo: Repository<UserBalance>,
  userId: number,
  assetId: string,
): Promise<UserBalance | null> {
  return userBalanceRepo.findOne({
    where: {
      userId: userId.toString(),
      assetId,
    },
  });
}

/**
 * Get all balances for user
 */
export async function getAllUserBalances(
  userBalanceRepo: Repository<UserBalance>,
  userId: number,
): Promise<UserBalance[]> {
  return userBalanceRepo.find({
    where: { userId: userId.toString() },
  });
}

/**
 * Update balance amount
 */
export async function updateBalance(
  userBalanceRepo: Repository<UserBalance>,
  userId: number,
  assetId: string,
  newAmount: number,
): Promise<UserBalance> {
  const balance = await userBalanceRepo.findOne({
    where: {
      userId: userId.toString(),
      assetId,
    },
  });

  if (!balance) {
    throw new Error(`Balance not found for user ${userId} and asset ${assetId}`);
  }

  balance.amount = newAmount;
  await userBalanceRepo.save(balance);
  return balance;
}
