import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';
import { Order } from '../entities/order.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../common/enums/order-type.enum';
import { OrderBookService } from './order-book.service';
import { WebSocketService } from '../../websocket/services/websocket.service';
import type { OrderUpdate } from '../../websocket/interfaces/websocket.interfaces';

/**
 * Periodically sweeps dormant STOP_LOSS / TAKE_PROFIT / TRAILING_STOP
 * orders and checks each against the current asset price.
 *
 * Trigger semantics:
 *  - STOP_LOSS (SELL): triggers when price <= stopPrice (protects against
 *    further downside).
 *  - STOP_LOSS (BUY):  triggers when price >= stopPrice (protects a short
 *    position / caps entry price on a breakout).
 *  - TAKE_PROFIT (SELL): triggers when price >= stopPrice.
 *  - TAKE_PROFIT (BUY):  triggers when price <= stopPrice.
 *  - TRAILING_STOP (SELL): trailingReferencePrice ratchets UP as price
 *    rises; triggers when price falls trailingDelta% below that peak.
 *  - TRAILING_STOP (BUY): trailingReferencePrice ratchets DOWN as price
 *    falls; triggers when price rises trailingDelta% above that trough.
 *
 * On trigger, the order is converted into an active MARKET taker order
 * and handed to OrderBookService.matchTakerOrder() inside a transaction.
 */
@Injectable()
export class StopOrderMonitorService {
  private readonly logger = new Logger(StopOrderMonitorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly orderBookService: OrderBookService,
    private readonly webSocketService: WebSocketService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async sweep(): Promise<void> {
    const orderRepo = this.dataSource.getRepository(Order);

    const dormant = await orderRepo.find({
      where: [
        { type: OrderType.STOP_LOSS, status: OrderStatus.PENDING },
        { type: OrderType.TAKE_PROFIT, status: OrderStatus.PENDING },
        { type: OrderType.TRAILING_STOP, status: OrderStatus.PENDING },
      ],
    });

    if (dormant.length === 0) return;

    const assetIds = [...new Set(dormant.map((o) => o.assetId))];
    const assets = await this.dataSource
      .getRepository(VirtualAsset)
      .findBy({ id: In(assetIds) });
    const priceByAsset = new Map(assets.map((a) => [a.id, Number(a.price)]));

    for (const order of dormant) {
      const currentPrice = priceByAsset.get(order.assetId);
      if (currentPrice == null) continue;

      try {
        if (order.type === OrderType.TRAILING_STOP) {
          await this.processTrailingStop(order, currentPrice);
        } else {
          await this.processFixedStop(order, currentPrice);
        }
      } catch (err) {
        this.logger.error(`Failed to process stop order ${order.id}: ${err}`);
      }
    }
  }

  private async processFixedStop(
    order: Order,
    currentPrice: number,
  ): Promise<void> {
    const stopPrice = Number(order.stopPrice);
    const triggered = this.isFixedStopTriggered(order, currentPrice, stopPrice);
    if (triggered) {
      await this.trigger(order, currentPrice);
    }
  }

  private isFixedStopTriggered(
    order: Order,
    currentPrice: number,
    stopPrice: number,
  ): boolean {
    if (order.type === OrderType.STOP_LOSS) {
      return order.side === OrderSide.SELL
        ? currentPrice <= stopPrice
        : currentPrice >= stopPrice;
    }
    // TAKE_PROFIT
    return order.side === OrderSide.SELL
      ? currentPrice >= stopPrice
      : currentPrice <= stopPrice;
  }

  private async processTrailingStop(
    order: Order,
    currentPrice: number,
  ): Promise<void> {
    const delta = Number(order.trailingDelta);
    const orderRepo = this.dataSource.getRepository(Order);

    let reference =
      order.trailingReferencePrice != null
        ? Number(order.trailingReferencePrice)
        : currentPrice;

    let referenceMoved = false;

    if (order.side === OrderSide.SELL) {
      if (currentPrice > reference) {
        reference = currentPrice;
        referenceMoved = true;
      }
      const effectiveStop = reference * (1 - delta / 100);
      if (currentPrice <= effectiveStop) {
        await this.trigger(order, currentPrice);
        return;
      }
    } else {
      if (currentPrice < reference) {
        reference = currentPrice;
        referenceMoved = true;
      }
      const effectiveStop = reference * (1 + delta / 100);
      if (currentPrice >= effectiveStop) {
        await this.trigger(order, currentPrice);
        return;
      }
    }

    if (referenceMoved) {
      order.trailingReferencePrice = reference;
      await orderRepo.save(order);
    }
  }

  private async trigger(order: Order, triggerPrice: number): Promise<void> {
    const result = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);

      const fresh = await orderRepo.findOne({
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fresh || fresh.status !== OrderStatus.PENDING) return null;

      fresh.status = OrderStatus.TRIGGERED;
      fresh.triggeredAt = new Date();
      await manager.save(Order, fresh);

      this.logger.log(
        `Order ${fresh.id} triggered at price ${triggerPrice} (type=${fresh.type})`,
      );

      fresh.status = OrderStatus.PENDING;
      await this.orderBookService.matchTakerOrder(manager, fresh);
      return fresh;
    });

    if (result) {
      this.broadcastOrder(result);
    }
  }

  /**
   * Mirrors OrdersService.broadcastOrder — duplicated rather than shared
   * because StopOrderMonitorService triggers orders autonomously, outside
   * any OrdersService method call, and pulling in OrdersService here would
   * create a circular dependency (OrdersModule already provides both).
   */
  private broadcastOrder(order: Order): void {
    const statusMap: Record<OrderStatus, OrderUpdate['status']> = {
      [OrderStatus.PENDING]: 'pending',
      [OrderStatus.PARTIAL]: 'partially_filled',
      [OrderStatus.FILLED]: 'filled',
      [OrderStatus.CANCELLED]: 'cancelled',
      [OrderStatus.TRIGGERED]: 'pending',
      [OrderStatus.REJECTED]: 'cancelled',
    };

    const update: OrderUpdate = {
      id: order.id,
      userId: String(order.userId),
      asset: String(order.assetId),
      type: order.side === OrderSide.BUY ? 'buy' : 'sell',
      amount: Number(order.amount),
      price: Number(order.price ?? order.averageFillPrice ?? 0),
      filled: Number(order.filledAmount),
      remaining: Number(order.remainingAmount),
      status: statusMap[order.status],
      timestamp: new Date().toISOString(),
    };

    this.webSocketService.broadcastOrderUpdate(update);
  }
}
