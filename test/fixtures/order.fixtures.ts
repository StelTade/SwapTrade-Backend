/**
 * Test Order Fixtures
 * Factory functions for creating test orders
 */

import { Repository } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { OrderBook } from '../../src/trading/entities/order-book.entity';
import { OrderType } from '../../src/common/enums/order-type.enum';
import { OrderStatus } from '../../src/common/enums/order-status.enum';

export interface CreateOrderConfig {
  userId: number;
  asset: string;
  type: OrderType;
  amount: number;
  price: number;
  status?: OrderStatus;
}

/**
 * Create test order
 */
export async function createTestOrder(
  orderBookRepo: Repository<OrderBook>,
  config: CreateOrderConfig,
): Promise<OrderBook> {
  const order = orderBookRepo.create({
    userId: config.userId,
    asset: config.asset,
    type: config.type,
    amount: config.amount,
    price: config.price,
    status: config.status || OrderStatus.PENDING,
    filledAmount: 0,
    remainingAmount: config.amount,
    createdAt: new Date(),
  });

  await orderBookRepo.save(order);
  return order;
}

/**
 * Create BUY order
 */
export async function createBuyOrder(
  orderBookRepo: Repository<OrderBook>,
  user: User,
  asset: string,
  amount: number,
  price: number,
): Promise<OrderBook> {
  return createTestOrder(orderBookRepo, {
    userId: user.id,
    asset,
    type: OrderType.BUY,
    amount,
    price,
  });
}

/**
 * Create SELL order
 */
export async function createSellOrder(
  orderBookRepo: Repository<OrderBook>,
  user: User,
  asset: string,
  amount: number,
  price: number,
): Promise<OrderBook> {
  return createTestOrder(orderBookRepo, {
    userId: user.id,
    asset,
    type: OrderType.SELL,
    amount,
    price,
  });
}

/**
 * Get pending orders for asset
 */
export async function getPendingOrders(
  orderBookRepo: Repository<OrderBook>,
  asset: string,
): Promise<OrderBook[]> {
  return orderBookRepo.find({
    where: {
      asset,
      status: OrderStatus.PENDING,
    },
    order: { price: 'ASC' },
  });
}

/**
 * Get user's pending orders
 */
export async function getUserPendingOrders(
  orderBookRepo: Repository<OrderBook>,
  userId: number,
): Promise<OrderBook[]> {
  return orderBookRepo.find({
    where: {
      userId,
      status: OrderStatus.PENDING,
    },
  });
}

/**
 * Get user's all orders
 */
export async function getUserOrders(
  orderBookRepo: Repository<OrderBook>,
  userId: number,
): Promise<OrderBook[]> {
  return orderBookRepo.find({
    where: { userId },
  });
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderBookRepo: Repository<OrderBook>,
  orderId: number,
  status: OrderStatus,
): Promise<OrderBook> {
  const order = await orderBookRepo.findOne({ where: { id: orderId } });
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  order.status = status;
  if (status === OrderStatus.EXECUTED) {
    order.filledAmount = order.amount;
    order.remainingAmount = 0;
    order.executedAt = new Date();
  }

  await orderBookRepo.save(order);
  return order;
}

/**
 * Partially fill order
 */
export async function partiallyFillOrder(
  orderBookRepo: Repository<OrderBook>,
  orderId: number,
  filledAmount: number,
): Promise<OrderBook> {
  const order = await orderBookRepo.findOne({ where: { id: orderId } });
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (filledAmount > order.amount) {
    throw new Error('Filled amount cannot exceed order amount');
  }

  order.filledAmount = filledAmount;
  order.remainingAmount = order.amount - filledAmount;

  if (order.remainingAmount === 0) {
    order.status = OrderStatus.EXECUTED;
    order.executedAt = new Date();
  } else {
    order.status = OrderStatus.PARTIALLY_FILLED;
  }

  await orderBookRepo.save(order);
  return order;
}

/**
 * Generate matching orders (BUY and SELL at same price)
 */
export async function generateMatchingOrders(
  orderBookRepo: Repository<OrderBook>,
  buyerId: number,
  sellerId: number,
  asset: string,
  amount: number,
  price: number,
): Promise<{ buyOrder: OrderBook; sellOrder: OrderBook }> {
  const buyOrder = await createTestOrder(orderBookRepo, {
    userId: buyerId,
    asset,
    type: OrderType.BUY,
    amount,
    price,
  });

  const sellOrder = await createTestOrder(orderBookRepo, {
    userId: sellerId,
    asset,
    type: OrderType.SELL,
    amount,
    price,
  });

  return { buyOrder, sellOrder };
}
