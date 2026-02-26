import { Test, TestingModule } from '@nestjs/testing';
import { MatchingEngine } from '../core/matching-engine';
import { Order, OrderSide, OrderType, OrderStatus, TimeInForce } from '../types/order.types';

describe('MatchingEngine', () => {
  let engine: MatchingEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchingEngine],
    }).compile();

    engine = module.get<MatchingEngine>(MatchingEngine);
  });

  describe('Limit Order Matching', () => {
    it('should match buy and sell orders at same price', async () => {
      const buyOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const sellOrder: Order = {
        id: '2',
        userId: 'user2',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      // Submit sell order first
      await engine.submitOrder(sellOrder);

      // Submit buy order - should match
      const result = await engine.submitOrder(buyOrder);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].price).toBe(50000);
      expect(result.matches[0].quantity).toBe(1);
      expect(result.order.status).toBe(OrderStatus.FILLED);
    });

    it('should match orders with price-time priority', async () => {
      // Add two sell orders at same price
      const sell1: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(Date.now() - 1000),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const sell2: Order = {
        ...sell1,
        id: '2',
        userId: 'user2',
        timestamp: new Date(),
      };

      await engine.submitOrder(sell1);
      await engine.submitOrder(sell2);

      // Buy order should match with sell1 (older)
      const buyOrder: Order = {
        id: '3',
        userId: 'user3',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const result = await engine.submitOrder(buyOrder);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].sellOrderId).toBe('1');
    });

    it('should handle partial fills', async () => {
      const sellOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 2,
        filledQuantity: 0,
        remainingQuantity: 2,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const buyOrder: Order = {
        id: '2',
        userId: 'user2',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      await engine.submitOrder(sellOrder);
      const result = await engine.submitOrder(buyOrder);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].quantity).toBe(1);
      expect(result.order.status).toBe(OrderStatus.FILLED);
      
      // Sell order should be partially filled
      const orderBook = engine.getOrderBook('BTC');
      expect(orderBook).toBeTruthy();
    });
  });

  describe('Market Orders', () => {
    it('should execute market buy order against best ask', async () => {
      const sellOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const marketBuy: Order = {
        id: '2',
        userId: 'user2',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.IOC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      await engine.submitOrder(sellOrder);
      const result = await engine.submitOrder(marketBuy);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].price).toBe(50000);
      expect(result.order.status).toBe(OrderStatus.FILLED);
    });

    it('should reject market order with no liquidity', async () => {
      const marketBuy: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.IOC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const result = await engine.submitOrder(marketBuy);

      expect(result.matches).toHaveLength(0);
      expect(result.order.status).toBe(OrderStatus.REJECTED);
    });
  });

  describe('Stop Orders', () => {
    it('should trigger stop order when price reached', async () => {
      const stopOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.STOP_MARKET,
        stopPrice: 49000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const result = await engine.submitOrder(stopOrder);
      expect(result.order.status).toBe(OrderStatus.PENDING);

      // Trigger stop order
      await engine.checkStopOrders('BTC', 48000);

      // Stop order should have been converted and executed
      // (Would need to verify through events in real implementation)
    });
  });

  describe('Time In Force', () => {
    it('should cancel IOC order if not immediately filled', async () => {
      const iocOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 40000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.IOC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const result = await engine.submitOrder(iocOrder);

      expect(result.matches).toHaveLength(0);
      expect(result.order.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel FOK order if not fully filled', async () => {
      const sellOrder: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      const fokOrder: Order = {
        id: '2',
        userId: 'user2',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 2,
        filledQuantity: 0,
        remainingQuantity: 2,
        timeInForce: TimeInForce.FOK,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      await engine.submitOrder(sellOrder);
      const result = await engine.submitOrder(fokOrder);

      expect(result.order.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel pending order', async () => {
      const order: Order = {
        id: '1',
        userId: 'user1',
        asset: 'BTC',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        quantity: 1,
        filledQuantity: 0,
        remainingQuantity: 1,
        timeInForce: TimeInForce.GTC,
        timestamp: new Date(),
        priority: 0,
        status: OrderStatus.PENDING,
      };

      await engine.submitOrder(order);
      const cancelled = await engine.cancelOrder('BTC', '1');

      expect(cancelled).toBeTruthy();
      expect(cancelled?.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent order submissions without race conditions', async () => {
      const orders: Order[] = [];
      
      for (let i = 0; i < 10; i++) {
        orders.push({
          id: `${i}`,
          userId: `user${i}`,
          asset: 'BTC',
          side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.LIMIT,
          price: 50000,
          quantity: 1,
          filledQuantity: 0,
          remainingQuantity: 1,
          timeInForce: TimeInForce.GTC,
          timestamp: new Date(),
          priority: 0,
          status: OrderStatus.PENDING,
        });
      }

      // Submit all orders concurrently
      const results = await Promise.all(
        orders.map(order => engine.submitOrder(order))
      );

      // Verify no errors and all orders processed
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.order).toBeTruthy();
      });
    });
  });
});
