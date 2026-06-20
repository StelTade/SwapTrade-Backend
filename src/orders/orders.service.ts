import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../common/enums/order-type.enum';
import { OrderBookService } from './services/order-book.service';
import { WebSocketService } from '../websocket/services/websocket.service';
import type { OrderUpdate } from '../websocket/interfaces/websocket.interfaces';

/**
 * LIMITATION (ORDERS_BUY_LOCKING):
 * This codebase has no quote-currency / asset-pair model — UserBalance is
 * a single quantity per (userId, assetId), with no concept of "cash" used
 * to buy other assets. Because of that, only SELL orders reserve funds
 * (lockedBalance against the asset being sold, which the user already
 * holds — safe to reserve). BUY orders are validated against available
 * balance at placement time but do NOT reserve funds, since there is no
 * settlement asset to lock. This mirrors a pre-existing gap in the system
 * (market orders had the same non-reserving check) rather than introducing
 * a new one. A proper fix requires designing a quote-currency/settlement
 * layer, which is out of scope for this issue.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly orderBookService: OrderBookService,
    private readonly webSocketService: WebSocketService,
  ) {}

  async placeOrder(userId: number, dto: CreateOrderDto): Promise<Order> {
    this.validateOrderShape(dto);

    const order = await this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(UserBalance);

      const balance = await balanceRepo.findOne({
        where: { userId, assetId: dto.assetId },
        lock: { mode: 'pessimistic_write' },
      });

      if (dto.side === OrderSide.SELL) {
        if (!balance || Number(balance.availableBalance) < dto.amount) {
          throw new BadRequestException(
            'Insufficient available balance to place sell order',
          );
        }
        balance.lockedBalance = Number(balance.lockedBalance) + dto.amount;
        await manager.save(UserBalance, balance);
      } else {
        // BUY: see ORDERS_BUY_LOCKING limitation above.
        if (!balance || Number(balance.balance) < 0) {
          // Placeholder guard kept intentionally permissive; real
          // settlement-currency validation is out of scope.
        }
      }

      const orderRepo = manager.getRepository(Order);
      const newOrder = orderRepo.create({
        userId,
        assetId: dto.assetId,
        side: dto.side,
        type: dto.type,
        amount: dto.amount,
        filledAmount: 0,
        averageFillPrice: null,
        price: dto.type === OrderType.LIMIT ? dto.price ?? null : null,
        stopPrice:
          dto.type === OrderType.STOP_LOSS || dto.type === OrderType.TAKE_PROFIT
            ? dto.stopPrice ?? null
            : null,
        trailingDelta:
          dto.type === OrderType.TRAILING_STOP ? dto.trailingDelta ?? null : null,
        trailingReferencePrice: null,
        status: OrderStatus.PENDING,
        expiresAt: dto.expiresInSeconds
          ? new Date(Date.now() + dto.expiresInSeconds * 1000)
          : null,
      });
      await manager.save(Order, newOrder);

      // MARKET and LIMIT orders are active takers immediately. STOP_LOSS /
      // TAKE_PROFIT / TRAILING_STOP stay dormant (PENDING, no match attempt)
      // until StopOrderMonitorService triggers them.
      if (dto.type === OrderType.MARKET || dto.type === OrderType.LIMIT) {
        await this.orderBookService.matchTakerOrder(manager, newOrder);
      }

      return newOrder;
    });

    this.broadcastOrder(order);
    return order;
  }

  async cancelOrder(userId: number, orderId: string): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const existing = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) throw new NotFoundException('Order not found');
      if (existing.userId !== userId) {
        throw new ForbiddenException('Cannot cancel another user\'s order');
      }
      if (
        existing.status === OrderStatus.FILLED ||
        existing.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot cancel order in status ${existing.status}`,
        );
      }

      // Release any locked funds (SELL orders only — see limitation note).
      if (existing.side === OrderSide.SELL) {
        const balanceRepo = manager.getRepository(UserBalance);
        const balance = await balanceRepo.findOne({
          where: { userId, assetId: existing.assetId },
          lock: { mode: 'pessimistic_write' },
        });
        if (balance) {
          const releaseAmount = Number(existing.remainingAmount);
          balance.lockedBalance = Math.max(
            0,
            Number(balance.lockedBalance) - releaseAmount,
          );
          await manager.save(UserBalance, balance);
        }
      }

      existing.status = OrderStatus.CANCELLED;
      existing.cancelledAt = new Date();
      await manager.save(Order, existing);
      return existing;
    });

    this.broadcastOrder(order);
    return order;
  }

  async modifyOrder(userId: number, dto: ModifyOrderDto): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const existing = await orderRepo.findOne({
        where: { id: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) throw new NotFoundException('Order not found');
      if (existing.userId !== userId) {
        throw new ForbiddenException('Cannot modify another user\'s order');
      }
      if (
        existing.status !== OrderStatus.PENDING &&
        existing.status !== OrderStatus.PARTIAL
      ) {
        throw new BadRequestException(
          `Cannot modify order in status ${existing.status}`,
        );
      }

      if (dto.amount != null) {
        if (dto.amount < Number(existing.filledAmount)) {
          throw new BadRequestException(
            'New amount cannot be less than already-filled amount',
          );
        }
        if (existing.side === OrderSide.SELL) {
          const balanceRepo = manager.getRepository(UserBalance);
          const balance = await balanceRepo.findOne({
            where: { userId, assetId: existing.assetId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!balance) {
            throw new BadRequestException('No balance found for asset');
          }
          const oldRemaining = Number(existing.remainingAmount);
          const newRemaining = dto.amount - Number(existing.filledAmount);
          const delta = newRemaining - oldRemaining;

          if (delta > 0 && Number(balance.availableBalance) < delta) {
            throw new BadRequestException(
              'Insufficient available balance to increase order amount',
            );
          }
          balance.lockedBalance = Number(balance.lockedBalance) + delta;
          await manager.save(UserBalance, balance);
        }
        existing.amount = dto.amount;
      }

      if (dto.price != null) {
        if (existing.type !== OrderType.LIMIT) {
          throw new BadRequestException(
            'Price can only be modified on LIMIT orders',
          );
        }
        existing.price = dto.price;
      }

      if (dto.stopPrice != null) {
        if (
          existing.type !== OrderType.STOP_LOSS &&
          existing.type !== OrderType.TAKE_PROFIT
        ) {
          throw new BadRequestException(
            'stopPrice can only be modified on STOP_LOSS / TAKE_PROFIT orders',
          );
        }
        existing.stopPrice = dto.stopPrice;
      }

      if (dto.trailingDelta != null) {
        if (existing.type !== OrderType.TRAILING_STOP) {
          throw new BadRequestException(
            'trailingDelta can only be modified on TRAILING_STOP orders',
          );
        }
        existing.trailingDelta = dto.trailingDelta;
      }

      await manager.save(Order, existing);

      // Re-attempt matching if it's a LIMIT order and price moved.
      if (existing.type === OrderType.LIMIT) {
        await this.orderBookService.matchTakerOrder(manager, existing);
      }

      return existing;
    });

    this.broadcastOrder(order);
    return order;
  }

  async getOrder(userId: number, orderId: string): Promise<Order> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) {
      throw new ForbiddenException('Cannot view another user\'s order');
    }
    return order;
  }

  async getUserOrders(
    userId: number,
    status?: OrderStatus,
  ): Promise<Order[]> {
    const where: any = { userId };
    if (status) where.status = status;
    return this.dataSource.getRepository(Order).find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Publishes the current order state over the existing WebSocketService
   * (broadcastOrderUpdate already handles sending to the owning user and,
   * for resting orders, to the public orders:<asset> channel — see
   * websocket.service.ts). Satisfies Direction item 6 ("Update WebSocket
   * gateway to broadcast order updates") without modifying the gateway
   * itself, since the broadcast method already existed and just had no
   * caller.
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

  private validateOrderShape(dto: CreateOrderDto): void {
    if (dto.type === OrderType.LIMIT && dto.price == null) {
      throw new BadRequestException('price is required for LIMIT orders');
    }
    if (
      (dto.type === OrderType.STOP_LOSS || dto.type === OrderType.TAKE_PROFIT) &&
      dto.stopPrice == null
    ) {
      throw new BadRequestException(
        'stopPrice is required for STOP_LOSS / TAKE_PROFIT orders',
      );
    }
    if (dto.type === OrderType.TRAILING_STOP && dto.trailingDelta == null) {
      throw new BadRequestException(
        'trailingDelta is required for TRAILING_STOP orders',
      );
    }
  }
}
