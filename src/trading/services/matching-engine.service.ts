import { Injectable } from '@nestjs/common';
import { Order } from '../entities/order.entity';
import { OrderBook } from './order-book.service';
import { Trade } from '../entities/trade.entity';
import { OrderStatus, OrderSide } from '../enums/order.enum';

@Injectable()
export class MatchingEngine {
  private readonly orderBooks: Map<string, OrderBook> = new Map();

  addOrder(order: Order): Trade[] {
    const orderBook = this.getOrderBook(order.assetPair);
    orderBook.addOrder(order);
    return this.matchOrders(order.assetPair);
  }

  private getOrderBook(assetPair: string): OrderBook {
    let book = this.orderBooks.get(assetPair);
    if (!book) {
      book = new OrderBook();
      this.orderBooks.set(assetPair, book);
    }
    return book;
  }

  private matchOrders(assetPair: string): Trade[] {
    const trades: Trade[] = [];
    const orderBook = this.getOrderBook(assetPair);
    const bids = orderBook.getBids();
    const asks = orderBook.getAsks();

    while (
      bids.length > 0 &&
      asks.length > 0 &&
      bids[0].price >= asks[0].price
    ) {
      const bestBid = bids[0];
      const bestAsk = asks[0];
      const tradeQuantity = Math.min(
        bestBid.quantity - bestBid.filledQuantity,
        bestAsk.quantity - bestAsk.filledQuantity,
      );

      const trade = new Trade();
      trade.assetPair = assetPair;
      trade.price = bestAsk.price;
      trade.quantity = tradeQuantity;
      trade.takerOrderId = bestBid.id;
      trade.makerOrderId = bestAsk.id;
      trade.timestamp = new Date();
      trades.push(trade);

      bestBid.filledQuantity += tradeQuantity;
      bestAsk.filledQuantity += tradeQuantity;

      if (bestBid.filledQuantity === bestBid.quantity) {
        bestBid.status = OrderStatus.FILLED;
        bids.shift();
      } else {
        bestBid.status = OrderStatus.PARTIALLY_FILLED;
      }

      if (bestAsk.filledQuantity === bestAsk.quantity) {
        bestAsk.status = OrderStatus.FILLED;
        asks.shift();
      } else {
        bestAsk.status = OrderStatus.PARTIALLY_FILLED;
      }
    }
    return trades;
  }
}
