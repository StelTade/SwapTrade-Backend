import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { OrderSide, OrderStatus, OrderType } from '../../common/enums/order-type.enum';

export interface FillResult {
  takerOrder: Order;
  makerOrder: Order;
  fillAmount: number;
  fillPrice: number;
}

export interface OrderBookLevelSnapshot {
  price: number;
  amount: number;
  count: number;
}

export interface OrderBookSnapshot {
  assetId: number;
  bids: OrderBookLevelSnapshot[];
  asks: OrderBookLevelSnapshot[];
}

/**
 * Pure limit-order matching engine. Operates on resting LIMIT orders for
 * a single asset using price-time priority:
 *   - BUY taker matches against SELL makers, lowest price first.
 *   - SELL taker matches against BUY makers, highest price first.
 *   - Ties broken by earliest createdAt (FIFO).
 *
 * MARKET orders, and STOP/TAKE_PROFIT/TRAILING_STOP orders that have
 * just triggered, are matched the same way via matchTakerOrder() — the
 * caller is responsible for deciding *when* a dormant order becomes an
 * active taker (see StopOrderMonitorService).
 *
 * All matching happens inside a caller-supplied transaction with
 * pessimistic row locks to prevent two concurrent orders from matching
 * against the same resting liquidity twice.
 */
@Injectable()
export class OrderBookService {
  private readonly logger = new Logger(OrderBookService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Attempts to match `takerOrder` against resting opposite-side LIMIT
   * orders for the same asset. Mutates and persists both taker and maker
   * orders as fills occur. Returns the list of fills that happened.
   *
   * Must be called with an active EntityManager from a transaction the
   * caller owns (see OrdersService.placeOrder), so balance settlement
   * and order-book mutation commit/rollback atomically together.
   */
  async matchTakerOrder(
    manager: EntityManager,
    takerOrder: Order,
  ): Promise<FillResult[]> {
    const fills: FillResult[] = [];
    const oppositeSide =
      takerOrder.side === OrderSide.BUY ? OrderSide.SELL : OrderSide.BUY;

    const orderRepo = manager.getRepository(Order);

    while (Number(takerOrder.remainingAmount) > 0) {
      // Pull the single best-priced resting maker order, locked for update
      // so concurrent matches can't double-fill it.
      const qb = orderRepo
        .createQueryBuilder('order')
        .where('order.assetId = :assetId', { assetId: takerOrder.assetId })
        .andWhere('order.side = :side', { side: oppositeSide })
        .andWhere('order.type = :type', { type: OrderType.LIMIT })
        .andWhere('order.status IN (:...statuses)', {
          statuses: [OrderStatus.PENDING, OrderStatus.PARTIAL],
        })
        .setLock('pessimistic_write');

      if (takerOrder.side === OrderSide.BUY) {
        // Buying: only match asks at or below what we're willing to pay
        // (limit takers respect their own price; market takers have no
        // price ceiling).
        if (takerOrder.type === OrderType.LIMIT && takerOrder.price != null) {
          qb.andWhere('order.price <= :price', { price: takerOrder.price });
        }
        qb.orderBy('order.price', 'ASC').addOrderBy('order.createdAt', 'ASC');
      } else {
        if (takerOrder.type === OrderType.LIMIT && takerOrder.price != null) {
          qb.andWhere('order.price >= :price', { price: takerOrder.price });
        }
        qb.orderBy('order.price', 'DESC').addOrderBy('order.createdAt', 'ASC');
      }

      const makerOrder = await qb.getOne();
      if (!makerOrder) break; // no more crossable liquidity

      const fillAmount = Math.min(
        Number(takerOrder.remainingAmount),
        Number(makerOrder.remainingAmount),
      );
      const fillPrice = Number(makerOrder.price); // maker's price always wins

      this.applyFill(takerOrder, fillAmount, fillPrice);
      this.applyFill(makerOrder, fillAmount, fillPrice);

      await manager.save(Order, makerOrder);

      const trade = manager.create(Trade, {
        userId: takerOrder.userId,
        asset: String(takerOrder.assetId),
        type: takerOrder.side,
        amount: fillAmount,
        price: fillPrice,
        totalValue: fillAmount * fillPrice,
        status: 'FILLED',
      });
      await manager.save(Trade, trade);

      fills.push({ takerOrder, makerOrder, fillAmount, fillPrice });
    }

    await manager.save(Order, takerOrder);
    return fills;
  }

  private applyFill(order: Order, fillAmount: number, fillPrice: number): void {
    const prevFilled = Number(order.filledAmount);
    const newFilled = prevFilled + fillAmount;

    // Recompute volume-weighted average fill price.
    const prevNotional = prevFilled * Number(order.averageFillPrice ?? 0);
    order.averageFillPrice = (prevNotional + fillAmount * fillPrice) / newFilled;
    order.filledAmount = newFilled;

    if (newFilled >= Number(order.amount)) {
      order.status = OrderStatus.FILLED;
      order.filledAt = new Date();
    } else {
      order.status = OrderStatus.PARTIAL;
    }
  }

  /** Aggregates resting LIMIT orders into bid/ask price levels for an asset. */
  async getOrderBookSnapshot(assetId: number): Promise<OrderBookSnapshot> {
    const orderRepo = this.dataSource.getRepository(Order);

    const resting = await orderRepo.find({
      where: [
        { assetId, type: OrderType.LIMIT, status: OrderStatus.PENDING },
        { assetId, type: OrderType.LIMIT, status: OrderStatus.PARTIAL },
      ],
    });

    const aggregate = (side: OrderSide): OrderBookLevelSnapshot[] => {
      const byPrice = new Map<number, OrderBookLevelSnapshot>();
      for (const order of resting.filter((o) => o.side === side)) {
        const price = Number(order.price);
        const remaining = Number(order.remainingAmount);
        const level = byPrice.get(price) ?? { price, amount: 0, count: 0 };
        level.amount += remaining;
        level.count += 1;
        byPrice.set(price, level);
      }
      return Array.from(byPrice.values());
    };

    return {
      assetId,
      bids: aggregate(OrderSide.BUY).sort((a, b) => b.price - a.price),
      asks: aggregate(OrderSide.SELL).sort((a, b) => a.price - b.price),
    };
  }
}
