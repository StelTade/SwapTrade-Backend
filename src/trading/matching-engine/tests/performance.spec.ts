import { Test, TestingModule } from '@nestjs/testing';
import { MatchingEngine } from '../core/matching-engine';
import { Order, OrderSide, OrderType, OrderStatus, TimeInForce } from '../types/order.types';

describe('MatchingEngine Performance', () => {
  let engine: MatchingEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchingEngine],
    }).compile();

    engine = module.get<MatchingEngine>(MatchingEngine);
  });

  describe('Throughput', () => {
    it('should handle 1000 orders in under 1 second', async () => {
      const orders: Order[] = [];
      
      // Create 1000 orders
      for (let i = 0; i < 1000; i++) {
        orders.push({
          id: `${i}`,
          userId: `user${i % 100}`,
          asset: 'BTC',
          side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.LIMIT,
          price: 50000 + (Math.random() * 1000 - 500),
          quantity: Math.random() * 10,
          filledQuantity: 0,
          remainingQuantity: Math.random() * 10,
          timeInForce: TimeInForce.GTC,
          timestamp: new Date(),
          priority: 0,
          status: OrderStatus.PENDING,
        });
      }

      const startTime = Date.now();
      
      // Submit all orders
      await Promise.all(orders.map(order => engine.submitOrder(order)));
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Processed 1000 orders in ${duration}ms`);
      console.log(`Throughput: ${(1000 / duration * 1000).toFixed(0)} orders/second`);

      expect(duration).toBeLessThan(1000);
    });

    it('should handle 10000 orders with acceptable latency', async () => {
      const orders: Order[] = [];
      const latencies: number[] = [];
      
      // Create 10000 orders
      for (let i = 0; i < 10000; i++) {
        orders.push({
          id: `${i}`,
          userId: `user${i % 1000}`,
          asset: 'BTC',
          side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.LIMIT,
          price: 50000 + (Math.random() * 1000 - 500),
          quantity: Math.random() * 10,
          filledQuantity: 0,
          remainingQuantity: Math.random() * 10,
          timeInForce: TimeInForce.GTC,
          timestamp: new Date(),
          priority: 0,
          status: OrderStatus.PENDING,
        });
      }

      const startTime = Date.now();
      
      // Submit orders and measure individual latencies
      for (const order of orders) {
        const orderStart = Date.now();
        await engine.submitOrder(order);
        latencies.push(Date.now() - orderStart);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Calculate statistics
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      console.log(`\nPerformance Statistics for 10000 orders:`);
      console.log(`Total duration: ${duration}ms`);
      console.log(`Throughput: ${(10000 / duration * 1000).toFixed(0)} orders/second`);
      console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`P95 latency: ${p95Latency.toFixed(2)}ms`);
      console.log(`Max latency: ${maxLatency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(10); // Average should be under 10ms
      expect(p95Latency).toBeLessThan(50); // P95 should be under 50ms
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent order submissions without deadlock', async () => {
      const assets = ['BTC', 'ETH', 'BNB', 'SOL'];
      const ordersPerAsset = 100;
      const allOrders: Order[] = [];

      // Create orders for multiple assets
      for (const asset of assets) {
        for (let i = 0; i < ordersPerAsset; i++) {
          allOrders.push({
            id: `${asset}-${i}`,
            userId: `user${i}`,
            asset,
            side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
            type: OrderType.LIMIT,
            price: 50000 + (Math.random() * 1000 - 500),
            quantity: Math.random() * 10,
            filledQuantity: 0,
            remainingQuantity: Math.random() * 10,
            timeInForce: TimeInForce.GTC,
            timestamp: new Date(),
            priority: 0,
            status: OrderStatus.PENDING,
          });
        }
      }

      const startTime = Date.now();
      
      // Submit all orders concurrently
      await Promise.all(allOrders.map(order => engine.submitOrder(order)));
      
      const duration = Date.now() - startTime;

      console.log(`\nConcurrent processing:`);
      console.log(`Processed ${allOrders.length} orders across ${assets.length} assets in ${duration}ms`);
      console.log(`Throughput: ${(allOrders.length / duration * 1000).toFixed(0)} orders/second`);

      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent cancellations', async () => {
      const orders: Order[] = [];
      
      // Submit 100 orders
      for (let i = 0; i < 100; i++) {
        const order: Order = {
          id: `${i}`,
          userId: `user${i}`,
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
        orders.push(order);
      }

      const startTime = Date.now();
      
      // Cancel all orders concurrently
      await Promise.all(
        orders.map(order => engine.cancelOrder('BTC', order.id))
      );
      
      const duration = Date.now() - startTime;

      console.log(`\nCancelled 100 orders in ${duration}ms`);

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Order Book Operations', () => {
    it('should efficiently handle deep order books', async () => {
      const priceRange = 1000;
      const ordersPerPrice = 10;

      // Create a deep order book
      for (let price = 49000; price < 49000 + priceRange; price += 10) {
        for (let i = 0; i < ordersPerPrice; i++) {
          const order: Order = {
            id: `${price}-${i}`,
            userId: `user${i}`,
            asset: 'BTC',
            side: OrderSide.SELL,
            type: OrderType.LIMIT,
            price,
            quantity: 1,
            filledQuantity: 0,
            remainingQuantity: 1,
            timeInForce: TimeInForce.GTC,
            timestamp: new Date(),
            priority: 0,
            status: OrderStatus.PENDING,
          };
          
          await engine.submitOrder(order);
        }
      }

      const orderBook = engine.getOrderBook('BTC');
      expect(orderBook).toBeTruthy();

      // Measure depth query performance
      const startTime = Date.now();
      const depth = orderBook!.getDepth(100);
      const duration = Date.now() - startTime;

      console.log(`\nOrder book depth query:`);
      console.log(`Queried 100 levels in ${duration}ms`);
      console.log(`Total ask levels: ${depth.asks.length}`);

      expect(duration).toBeLessThan(10);
    });

    it('should handle rapid price level changes', async () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Add order
        const order: Order = {
          id: `${i}`,
          userId: `user${i}`,
          asset: 'BTC',
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          price: 50000 + (i % 100),
          quantity: 1,
          filledQuantity: 0,
          remainingQuantity: 1,
          timeInForce: TimeInForce.GTC,
          timestamp: new Date(),
          priority: 0,
          status: OrderStatus.PENDING,
        };
        
        await engine.submitOrder(order);

        // Immediately cancel if even
        if (i % 2 === 0) {
          await engine.cancelOrder('BTC', order.id);
        }
      }

      const duration = Date.now() - startTime;

      console.log(`\nRapid price level changes:`);
      console.log(`${iterations} add/cancel operations in ${duration}ms`);
      console.log(`Throughput: ${(iterations / duration * 1000).toFixed(0)} ops/second`);

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with many orders', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and process 10000 orders
      for (let i = 0; i < 10000; i++) {
        const order: Order = {
          id: `${i}`,
          userId: `user${i % 100}`,
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
        };
        
        await engine.submitOrder(order);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`\nMemory usage:`);
      console.log(`Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Increase: ${memoryIncrease.toFixed(2)} MB`);

      // Memory increase should be reasonable (less than 100MB for 10000 orders)
      expect(memoryIncrease).toBeLessThan(100);
    });
  });
});
