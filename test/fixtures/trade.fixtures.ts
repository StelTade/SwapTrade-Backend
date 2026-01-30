/**
 * Test Trade Fixtures
 * Factory functions for creating and tracking test trades
 */

import { Repository } from 'typeorm';
import { Trade } from '../../src/trading/entities/trade.entity';
import { TradeType } from '../../src/common/enums/trade-type.enum';

export interface CreateTradeConfig {
  userId: number;
  asset: string;
  type: TradeType;
  amount: number;
  price: number;
}

/**
 * Create test trade
 */
export async function createTestTrade(
  tradeRepo: Repository<Trade>,
  config: CreateTradeConfig,
): Promise<Trade> {
  const trade = tradeRepo.create({
    userId: config.userId,
    asset: config.asset,
    type: config.type,
    amount: config.amount,
    price: config.price,
    createdAt: new Date(),
  });

  await tradeRepo.save(trade);
  return trade;
}

/**
 * Create BUY trade
 */
export async function createBuyTrade(
  tradeRepo: Repository<Trade>,
  userId: number,
  asset: string,
  amount: number,
  price: number,
): Promise<Trade> {
  return createTestTrade(tradeRepo, {
    userId,
    asset,
    type: TradeType.BUY,
    amount,
    price,
  });
}

/**
 * Create SELL trade
 */
export async function createSellTrade(
  tradeRepo: Repository<Trade>,
  userId: number,
  asset: string,
  amount: number,
  price: number,
): Promise<Trade> {
  return createTestTrade(tradeRepo, {
    userId,
    asset,
    type: TradeType.SELL,
    amount,
    price,
  });
}

/**
 * Get trades for user
 */
export async function getUserTrades(
  tradeRepo: Repository<Trade>,
  userId: number,
): Promise<Trade[]> {
  return tradeRepo.find({
    where: { userId },
    order: { createdAt: 'DESC' },
  });
}

/**
 * Get trades for asset
 */
export async function getAssetTrades(
  tradeRepo: Repository<Trade>,
  asset: string,
): Promise<Trade[]> {
  return tradeRepo.find({
    where: { asset },
    order: { createdAt: 'DESC' },
  });
}

/**
 * Get user's first trade
 */
export async function getUserFirstTrade(
  tradeRepo: Repository<Trade>,
  userId: number,
): Promise<Trade | null> {
  return tradeRepo.findOne({
    where: { userId },
    order: { createdAt: 'ASC' },
  });
}

/**
 * Get trade count for user
 */
export async function getUserTradeCount(
  tradeRepo: Repository<Trade>,
  userId: number,
): Promise<number> {
  return tradeRepo.count({
    where: { userId },
  });
}

/**
 * Calculate total trade volume for user
 */
export async function getUserTradeVolume(
  tradeRepo: Repository<Trade>,
  userId: number,
): Promise<number> {
  const trades = await getUserTrades(tradeRepo, userId);
  return trades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
}

/**
 * Calculate PnL for user (assuming cost basis is average price)
 */
export async function calculateUserPnL(
  tradeRepo: Repository<Trade>,
  userId: number,
  asset: string,
  currentPrice: number,
): Promise<number> {
  const trades = await tradeRepo.find({
    where: { userId, asset },
  });

  let totalCost = 0;
  let totalQuantity = 0;

  for (const trade of trades) {
    if (trade.type === TradeType.BUY) {
      totalCost += trade.amount * trade.price;
      totalQuantity += trade.amount;
    } else {
      totalCost -= trade.amount * trade.price;
      totalQuantity -= trade.amount;
    }
  }

  return totalQuantity * currentPrice - totalCost;
}

/**
 * Generate matching trades (buyer and seller)
 */
export async function generateMatchingTrades(
  tradeRepo: Repository<Trade>,
  buyerId: number,
  sellerId: number,
  asset: string,
  amount: number,
  price: number,
): Promise<{ buyTrade: Trade; sellTrade: Trade }> {
  const buyTrade = await createTestTrade(tradeRepo, {
    userId: buyerId,
    asset,
    type: TradeType.BUY,
    amount,
    price,
  });

  const sellTrade = await createTestTrade(tradeRepo, {
    userId: sellerId,
    asset,
    type: TradeType.SELL,
    amount,
    price,
  });

  return { buyTrade, sellTrade };
}
