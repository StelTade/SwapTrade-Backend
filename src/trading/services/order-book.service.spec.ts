import { OrderBook } from './order-book.service';
import { Order } from '../entities/order.entity';
import { OrderSide, OrderType, OrderStatus } from '../enums/order.enum';

describe('OrderBook', () => {
  let orderBook: OrderBook;

  beforeEach(() => {
    orderBook = new OrderBook();
  });

  it('should sort buy orders with highest price first (bids)', () => {
    const order1 = new Order();
    order1.id = '1';
    order1.side = OrderSide.BUY;
    order1.price = 100;
    order1.createdAt = new Date('2026-01-01T00:00:00Z');

    const order2 = new Order();
    order2.id = '2';
    order2.side = OrderSide.BUY;
    order2.price = 150;
    order2.createdAt = new Date('2026-01-01T00:00:01Z');

    orderBook.addOrder(order1);
    orderBook.addOrder(order2);

    const bids = orderBook.getBids();
    expect(bids.length).toBe(2);
    expect(bids[0].price).toBe(150);
    expect(bids[1].price).toBe(100);
  });

  it('should sort sell orders with lowest price first (asks)', () => {
    const order1 = new Order();
    order1.id = '1';
    order1.side = OrderSide.SELL;
    order1.price = 200;
    order1.createdAt = new Date('2026-01-01T00:00:00Z');

    const order2 = new Order();
    order2.id = '2';
    order2.side = OrderSide.SELL;
    order2.price = 180;
    order2.createdAt = new Date('2026-01-01T00:00:01Z');

    orderBook.addOrder(order1);
    orderBook.addOrder(order2);

    const asks = orderBook.getAsks();
    expect(asks.length).toBe(2);
    expect(asks[0].price).toBe(180);
    expect(asks[1].price).toBe(200);
  });
});
