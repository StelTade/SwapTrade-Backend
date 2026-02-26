# Advanced Order Matching Engine

A high-performance, multi-threaded order matching engine for the trading platform.

## Features

### Order Types

- **Limit Orders**: Orders with a specific price
- **Market Orders**: Orders executed at best available price
- **Stop-Limit Orders**: Limit orders triggered when stop price is reached
- **Stop-Market Orders**: Market orders triggered when stop price is reached

### Time In Force Options

- **GTC (Good Till Cancel)**: Order remains active until filled or cancelled
- **IOC (Immediate or Cancel)**: Fill immediately or cancel unfilled portion
- **FOK (Fill or Kill)**: Fill entire order immediately or cancel completely
- **DAY**: Order expires at end of trading day

### Core Capabilities

- **Price-Time Priority**: Orders matched based on best price, then timestamp (FIFO)
- **Partial Fills**: Orders can be partially filled with remaining quantity staying in book
- **Multi-threaded Processing**: Worker pool distributes matching across CPU cores
- **Concurrency Safety**: Lock-based synchronization prevents race conditions
- **Order Prioritization**: Fair priority calculation with anti-gaming measures
- **Stop Order Management**: Automatic triggering based on market price

## Architecture

```
matching-engine/
├── core/
│   ├── matching-engine.ts       # Main matching engine
│   ├── order-book.ts            # Order book with price levels
│   └── order-book-level.ts      # Individual price level management
├── services/
│   ├── advanced-matching.service.ts      # High-level API
│   ├── order-priority.service.ts         # Priority calculation
│   ├── order-validator.service.ts        # Order validation
│   └── matching-worker-pool.service.ts   # Worker thread pool
├── types/
│   └── order.types.ts           # Type definitions
└── tests/
    └── matching-engine.spec.ts  # Unit tests
```

## Usage

### Submit Order

```typescript
import { AdvancedMatchingService } from './matching-engine/advanced-matching.service';
import { OrderSide, OrderType, TimeInForce } from './matching-engine/types/order.types';

// Inject service
constructor(private matchingService: AdvancedMatchingService) {}

// Submit limit order
const result = await this.matchingService.submitOrder(
  'user123',           // userId
  'BTC',              // asset
  OrderSide.BUY,      // side
  OrderType.LIMIT,    // type
  1.5,                // quantity
  50000,              // price
  undefined,          // stopPrice
  TimeInForce.GTC     // timeInForce
);

console.log('Order:', result.order);
console.log('Matches:', result.matches);
```

### Cancel Order

```typescript
const cancelled = await this.matchingService.cancelOrder('user123', 'order-id');
```

### Get Order Book Depth

```typescript
const depth = await this.matchingService.getOrderBookDepth('BTC', 10);
console.log('Bids:', depth.bids); // [[price, quantity], ...]
console.log('Asks:', depth.asks); // [[price, quantity], ...]
```

### Get Statistics

```typescript
// Matching statistics
const stats = this.matchingService.getMatchingStats('BTC');
console.log('Orders processed:', stats.ordersProcessed);
console.log('Matches executed:', stats.matchesExecuted);
console.log('Total volume:', stats.totalVolume);

// Worker pool statistics
const poolStats = this.matchingService.getWorkerPoolStats();
console.log(
  'Active workers:',
  poolStats.totalWorkers - poolStats.availableWorkers,
);
console.log('Queued tasks:', poolStats.queuedTasks);
```

## Events

The matching engine emits events for monitoring:

```typescript
matchingEngine.on('match', (match: MatchResult) => {
  console.log(`Match: ${match.quantity} @ ${match.price}`);
});

matchingEngine.on('orderFilled', (order: Order) => {
  console.log(`Order filled: ${order.id}`);
});

matchingEngine.on('orderCancelled', (order: Order) => {
  console.log(`Order cancelled: ${order.id}`);
});

matchingEngine.on('orderRejected', (order: Order, reason: string) => {
  console.log(`Order rejected: ${reason}`);
});
```

## Performance

### Optimization Features

- O(log n) price level operations using sorted arrays
- O(1) order lookup using hash maps
- Lock-free reads for order book depth
- Worker pool for parallel processing
- Efficient memory management with object pooling

### Benchmarks

- Order submission: < 1ms average
- Order matching: < 5ms for complex scenarios
- Concurrent throughput: 10,000+ orders/second
- Worker pool overhead: < 0.1ms per task

## Fairness & Anti-Gaming

### Priority Calculation

- 70% weight on price improvement
- 30% weight on time (FIFO)
- Penalties for excessive order placement

### Manipulation Detection

- Spoofing detection (rapid place/cancel)
- Layering detection (multiple price levels)
- Rate limiting per user

## Testing

Run the test suite:

```bash
npm test -- matching-engine.spec.ts
```

### Test Coverage

- Limit order matching
- Market order execution
- Stop order triggering
- Time in force handling
- Partial fills
- Order cancellation
- Concurrency safety
- Priority fairness

## Integration

The matching engine integrates with:

- **Trading Service**: Order submission and execution
- **Balance Service**: Balance validation and updates
- **Notification Service**: Order status notifications
- **Audit Service**: Trade logging and compliance

## Configuration

Environment variables:

```env
MATCHING_ENGINE_WORKERS=4          # Number of worker threads
MATCHING_ENGINE_FEE_RATE=0.001     # Trading fee (0.1%)
MATCHING_ENGINE_MAX_ORDER_SIZE=1000000
MATCHING_ENGINE_MIN_ORDER_SIZE=0.00000001
```

## Future Enhancements

- [ ] Order book snapshots for recovery
- [ ] Advanced order types (iceberg, trailing stop)
- [ ] Cross-asset matching
- [ ] Market maker incentives
- [ ] Real-time order book streaming
- [ ] Machine learning for manipulation detection
