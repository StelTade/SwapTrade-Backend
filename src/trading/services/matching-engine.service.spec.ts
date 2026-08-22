import { MatchingEngine } from './matching-engine.service';
import { Order } from '../entities/order.entity';
import { OrderSide, OrderStatus, OrderType } from '../enums/order.enum';

describe('MatchingEngine', () => {
  let matchingEngine: MatchingEngine;

  beforeEach(() => {
    matchingEngine = new MatchingEngine();
  });

  it('should match buy and sell orders when prices overlap', () => {
    const buyOrder = new Order();
    buyOrder.id = 'buy-1';
    buyOrder.userId = 'user-1';
    buyOrder.assetPair = 'ETH/USDT';
    buyOrder.side = OrderSide.BUY;
    buyOrder.type = OrderType.LIMIT;
    buyOrder.price = 2000;
    buyOrder.quantity = 2;
    buyOrder.filledQuantity = 0;
    buyOrder.status = OrderStatus.OPEN;
    buyOrder.createdAt = new Date('2026-01-01T00:00:00Z');

    const sellOrder = new Order();
    sellOrder.id = 'sell-1';
    sellOrder.userId = 'user-2';
    sellOrder.assetPair = 'ETH/USDT';
    sellOrder.side = OrderSide.SELL;
    sellOrder.type = OrderType.LIMIT;
    sellOrder.price = 1900;
    sellOrder.quantity = 1;
    sellOrder.filledQuantity = 0;
    sellOrder.status = OrderStatus.OPEN;
    sellOrder.createdAt = new Date('2026-01-01T00:00:01Z');

    // Add buy order first (no match yet)
    const trades1 = matchingEngine.addOrder(buyOrder);
    expect(trades1.length).toBe(0);

    // Add sell order (should match)
    const trades2 = matchingEngine.addOrder(sellOrder);
    expect(trades2.length).toBe(1);
    expect(trades2[0].assetPair).toBe('ETH/USDT');
    expect(trades2[0].quantity).toBe(1);
    expect(trades2[0].price).toBe(1900);
    expect(trades2[0].takerOrderId).toBe('buy-1');
    expect(trades2[0].makerOrderId).toBe('sell-1');

    expect(sellOrder.status).toBe(OrderStatus.FILLED);
    expect(buyOrder.status).toBe(OrderStatus.PARTIALLY_FILLED);
    expect(buyOrder.filledQuantity).toBe(1);
  });
});
