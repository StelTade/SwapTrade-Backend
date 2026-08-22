import { Injectable } from '@nestjs/common';
import { Order } from '../entities/order.entity';
import { OrderSide } from '../enums/order.enum';

@Injectable()
export class OrderBook {
  private readonly bids: Order[] = [];
  private readonly asks: Order[] = [];

  getBids(): Order[] {
    return this.bids;
  }

  getAsks(): Order[] {
    return this.asks;
  }

  addOrder(order: Order): void {
    if (order.side === OrderSide.BUY) {
      this.bids.push(order);
      this.bids.sort(
        (a, b) =>
          b.price - a.price || a.createdAt.getTime() - b.createdAt.getTime(),
      );
    } else {
      this.asks.push(order);
      this.asks.sort(
        (a, b) =>
          a.price - b.price || a.createdAt.getTime() - b.createdAt.getTime(),
      );
    }
  }
}
