# End-to-End Trading Tests - Task #103

This directory contains comprehensive E2E tests for the complete trading workflow, covering user signup through order settlement with full edge case and notification coverage.

## Overview

The test suite is organized into 4 main E2E test files covering the complete trading workflow:

### 1. **trading-workflow.e2e-spec.ts** - Complete Trading Workflow
Tests the full happy path: user registration → balance deposit → order placement → execution → settlement

**Coverage:**
- User signup and account creation
- Balance deposit and initial funding
- Order placement (BUY/SELL)
- Order execution and matching
- Trade settlement
- Balance updates
- Portfolio updates
- Multi-user concurrent trading

**Key Tests:**
- `should complete full workflow: signup → deposit → order → execution → settlement`
- `should handle order placement request structure`
- `should handle order execution with sufficient balance`
- `should track order-to-trade mapping`
- `should handle concurrent trades between multiple users`

### 2. **trading-edge-cases.e2e-spec.ts** - Edge Cases & Error Handling
Tests error conditions, race conditions, and boundary cases

**Coverage:**
- Insufficient balance prevention
- Duplicate order handling
- Race conditions (concurrent orders)
- Order cancellation
- Partial fills
- Order validation (negative amounts, zero prices)
- Double-spend prevention

**Key Test Suites:**
- **Insufficient Balance**
  - `should prevent order exceeding available balance`
  - `should track balance before and after trade`
  - `should reject negative balance`

- **Duplicate Orders Prevention**
  - `should allow multiple distinct orders`
  - `should handle rapid order creation`

- **Race Conditions**
  - `should handle concurrent orders on same asset`
  - `should prevent double-spend with concurrent balance operations`
  - `should track concurrent trade execution correctly`

- **Order Lifecycle**
  - `should handle order cancellation`
  - `should handle partial order fill`
  - `should prevent execution of already cancelled order`

- **Order Validation**
  - `should reject orders with invalid amounts`
  - `should reject orders with invalid prices`

### 3. **trading-portfolio.e2e-spec.ts** - Portfolio Balance Updates
Tests portfolio state management and statistics calculations

**Coverage:**
- Trade count tracking
- Trade volume calculation
- Profit & Loss (P&L) calculation
- Per-asset balance updates
- Portfolio statistics aggregation
- Trade date tracking

**Key Test Suites:**
- **Trade Count Tracking**
  - `should increment trade count on each trade`
  - `should track distinct trades per user`

- **Trade Volume Calculation**
  - `should calculate total trade volume correctly`
  - `should include both BUY and SELL in volume calculation`
  - `should handle zero trades volume`

- **Profit & Loss Calculation**
  - `should calculate PnL for BUY trades`
  - `should calculate negative PnL for losing trades`
  - `should calculate PnL with multiple BUY trades (average cost)`
  - `should handle mix of BUY and SELL trades`

- **Asset Balance Updates**
  - `should update BTC balance on BUY trade`
  - `should update USD balance on SELL trade`
  - `should track multiple asset balances independently`

- **Portfolio Statistics**
  - `should aggregate portfolio statistics correctly`
  - `should update portfolio on each trade`

### 4. **trading-notifications.e2e-spec.ts** - Notification Triggers
Tests event-driven notifications for trading events

**Coverage:**
- Order filled notifications
- Achievement/badge notifications
- Notification status (read/unread)
- Notification queue integration
- Event correlation
- Notification timing

**Key Test Suites:**
- **Order Filled Notifications**
  - `should create notification when order is filled`
  - `should include trade details in notification`
  - `should distinguish between BUY and SELL notifications`
  - `should notify multiple users independently`

- **Achievement Notifications**
  - `should notify on first trade achievement`
  - `should not notify on subsequent trades`
  - `should include achievement details in notification`

- **Notification Status**
  - `should mark notifications as read`
  - `should separate read and unread notifications`

- **Notification Queue Integration**
  - `should queue trade notification on order fill`
  - `should handle notification persistence errors`

- **Notification Timing**
  - `should include timestamp in notifications`
  - `should preserve notification order by time`

- **Event-Driven Notifications**
  - `should correlate notification with trade event`

## Test Fixtures

The test suite includes comprehensive fixtures for data generation:

### `test/fixtures/test-database.setup.ts`
Database initialization and cleanup utilities
- `initializeTestDatabase(dataSource)` - Initialize DB connection
- `resetTestDatabase(dataSource)` - Clean all test data
- `seedVirtualAssets(dataSource)` - Create BTC, ETH, USD assets
- `getTestRepositories(dataSource)` - Get repository instances

### `test/fixtures/user.fixtures.ts`
User creation and management
- `TEST_USERS` - Predefined test users (Alice, Bob, Charlie)
- `createTestUser(repo, data)` - Create single user
- `createTestUsers(repo, count)` - Create multiple users
- `getTestUserCredentials(name)` - Get user email/password
- `generateTestUserData(suffix)` - Generate unique user

**Default Test Users:**
```typescript
- alice@test.com / Alice@12345
- bob@test.com / Bob@67890
- charlie@test.com / Charlie@11111
```

### `test/fixtures/balance.fixtures.ts`
Balance initialization and tracking
- `DEFAULT_TEST_BALANCES` - Initial balances (USD: $10,000, BTC: 0.5, ETH: 5)
- `seedUserBalance()` - Seed single asset
- `seedDefaultUserBalances()` - Seed all default assets
- `getUserBalance()` - Get user balance for asset
- `getAllUserBalances()` - Get all user balances
- `updateBalance()` - Update balance amount

### `test/fixtures/order.fixtures.ts`
Order creation and manipulation
- `createTestOrder()` - Create order
- `createBuyOrder()` - Create BUY order
- `createSellOrder()` - Create SELL order
- `getUserPendingOrders()` - Get pending orders
- `getAssetOrderBook()` - Get orderbook
- `updateOrderStatus()` - Change order status
- `partiallyFillOrder()` - Partially fill order
- `cancelOrder()` - Cancel order

### `test/fixtures/trade.fixtures.ts`
Trade creation and analysis
- `createTestTrade()` - Create trade
- `createBuyTrade()` - Create BUY trade
- `createSellTrade()` - Create SELL trade
- `getUserTrades()` - Get user's trades
- `getUserTradeCount()` - Count user trades
- `getUserTradeVolume()` - Calculate trade volume
- `calculateUserPnL()` - Calculate P&L

## Running the Tests

### Run all E2E tests:
```bash
npm run test:e2e
```

### Run specific test file:
```bash
npm run test:e2e -- trading-workflow.e2e-spec.ts
npm run test:e2e -- trading-edge-cases.e2e-spec.ts
npm run test:e2e -- trading-portfolio.e2e-spec.ts
npm run test:e2e -- trading-notifications.e2e-spec.ts
```

### Run with coverage:
```bash
npm run test:cov
```

### Run in watch mode:
```bash
npm run test:watch
```

## Test Database Setup

Each test file automatically:
1. **Initializes** test database connection
2. **Cleans** all data before each test
3. **Seeds** virtual assets (BTC, ETH, USD)
4. **Provides** repository instances
5. **Cleans up** after all tests complete

### Database Structure

```
Database: swaptrade.db (SQLite)

Tables:
- user (id, email, username, passwordHash, createdAt)
- virtual_asset (id, name, symbol, initialPrice)
- user_balance (userId, assetId, amount, totalTrades, cumulativePnL, totalTradeVolume, lastTradeDate)
- order_book (id, userId, asset, type, status, amount, price, filledAmount, remainingAmount, createdAt, executedAt)
- trade (id, userId, asset, type, amount, price, createdAt)
- notification (id, userId, title, message, type, read, createdAt)
```

## Key Test Scenarios

### Scenario 1: Happy Path Trade
```
1. User registers with email/password
2. System creates user with zero balance
3. Seed user with $10,000 USD
4. Place BUY order: 0.5 BTC @ $45,000
5. Execute order (matching engine triggers)
6. Verify trade created
7. Verify balances updated:
   - USD: $10,000 → $7,750 (-$2,250 cost)
   - BTC: 0 → 0.5 (+0.5 BTC)
8. Verify portfolio updated:
   - Trade count: 1
   - Trade volume: $2,250
9. Verify notification queued
10. Verify achievement badge awarded (first trade)
```

### Scenario 2: Insufficient Balance
```
1. User has $10,000 USD
2. Try to place BUY order: 1 BTC @ $50,000
3. Order cost would be $50,000 > available $10,000
4. System prevents order placement
5. Balance remains unchanged
```

### Scenario 3: Concurrent Orders
```
1. Alice creates BUY order: 0.1 BTC @ $45,000
2. Bob creates BUY order: 0.1 BTC @ $45,000 (simultaneously)
3. Both orders created successfully
4. Each order independent
5. Orderbook shows 2 pending orders
```

### Scenario 4: Partial Fill
```
1. User places BUY order: 1 BTC @ $45,000
2. Order status: PENDING, filled: 0, remaining: 1
3. Partially filled: 0.3 BTC
4. Order status: PARTIALLY_FILLED, filled: 0.3, remaining: 0.7
5. Completely filled: remaining 0.7 BTC
6. Order status: EXECUTED, filled: 1, remaining: 0
```

## Enums & Constants

### OrderType
```typescript
- BUY
- SELL
```

### OrderStatus
```typescript
- PENDING
- PARTIAL_FILLED
- FILLED / EXECUTED
- CANCELLED
```

### TradeType
```typescript
- BUY
- SELL
```

### NotificationEventType
```typescript
- ORDER_FILLED
- ACHIEVEMENT_UNLOCKED
- PRICE_ALERT
```

## Asset Prices (Seeded)

```
BTC: $45,000
ETH: $2,500
USD: $1
```

## Default User Balances

```
USD: $10,000
BTC: 0.5
ETH: 5
```

## Error Handling

Tests verify proper error handling for:
- Invalid order amounts (negative, zero)
- Invalid order prices (negative, zero)
- Insufficient balance
- Non-existent orders
- Duplicate/concurrent operations
- Balance validation
- Order state transitions

## Assertions Used

- `expect(value).toBe(expected)` - Exact equality
- `expect(value).toEqual(expected)` - Deep equality
- `expect(value).toBeDefined()` - Property exists
- `expect(value).toContain(item)` - Contains item
- `expect(value).toBeGreaterThan(num)` - Greater than
- `expect([1,2,3]).toContain(value)` - In array
- `expect(error).toBeDefined()` - Error thrown

## Performance Considerations

- Tests use SQLite (fast for testing)
- Each test runs with fresh DB state
- Rapid order creation tested (5 concurrent)
- Database cleanup is automatic
- No external API calls
- Tests complete in seconds

## Future Enhancements

Potential additions to test suite:
- [ ] WebSocket notification testing
- [ ] Queue job processing verification
- [ ] Cache invalidation testing
- [ ] Database transaction rollback testing
- [ ] Performance benchmarks
- [ ] Rate limiting tests
- [ ] Badge/rewards system tests
- [ ] Portfolio milestone notifications
- [ ] Decimal precision tests
- [ ] Large volume stress tests

## Troubleshooting

### Tests fail with "Database not initialized"
```bash
# Ensure migrations are run
npm run migration:run
```

### "Order not found" errors
- Verify database is clean before test
- Check repositories are properly initialized

### Timing-sensitive failures
- Some tests have small delays (10-50ms)
- If CI is slow, may need to increase timeouts

### Memory issues
- Tests clean database after each suite
- Consider running tests in batches

## Contributing

When adding new tests:
1. Follow existing naming conventions
2. Use provided fixtures
3. Clean up after tests (`beforeEach`, `afterAll`)
4. Add descriptive comments
5. Group related tests in describe blocks
6. Test both success and error cases
7. Update this README with new test scenarios

## Related Files

- [BALANCE_HISTORY_API.md](../docs/BALANCE_HISTORY_API.md) - Balance tracking
- [PERFORMANCE_OPTIMIZATION.md](../docs/PERFORMANCE_OPTIMIZATION.md) - Cache strategies
- [ERROR_HANDLING.md](../docs/ERROR_HANDLING.md) - Error patterns
- [FILE_STRUCTURE.md](../docs/FILE_STRUCTURE.md) - Project structure

## Summary

This comprehensive E2E test suite provides:
- ✅ Complete workflow coverage
- ✅ Edge case handling
- ✅ Portfolio tracking
- ✅ Notification system
- ✅ Multi-user scenarios
- ✅ Race condition prevention
- ✅ Balance validation
- ✅ Achievement tracking
- ✅ P&L calculations
- ✅ Audit trails

**Total Test Cases:** 100+
**Lines of Test Code:** 3,000+
**Coverage Areas:** 7
**Fixture Functions:** 50+
