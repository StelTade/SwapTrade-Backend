# WebSocket API Documentation

## Overview

The SwapTrade WebSocket API provides real-time updates for trading activities, market data, and user-specific events. The API uses Socket.IO for reliable WebSocket communication with fallback to long polling.

## Connection

### Base URL
```
Production: wss://api.swaptrade.com
Development: ws://localhost:3000
```

### Namespaces

#### Main Namespace (`/`)
General WebSocket connection for system events and basic functionality.

#### Trading Namespace (`/trading`)
Dedicated namespace for trading-related events and market data.

### Authentication

WebSocket connections require authentication using JWT tokens.

#### Method 1: Query Parameter
```javascript
const socket = io('ws://localhost:3000', {
  query: { token: 'your-jwt-token' }
});
```

#### Method 2: Auth Object
```javascript
const socket = io('ws://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

#### Method 3: Post-Connection Authentication
```javascript
const socket = io('ws://localhost:3000');

socket.emit('authenticate', {
  token: 'your-jwt-token'
});
```

## Message Format

All WebSocket messages follow this structure:

```typescript
interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}
```

## Events

### Connection Events

#### `connect`
Emitted when client successfully connects.

```javascript
socket.on('connect', () => {
  console.log('Connected to WebSocket');
});
```

#### `disconnect`
Emitted when client disconnects.

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### `authenticate`
Send authentication token.

```javascript
socket.emit('authenticate', {
  token: 'your-jwt-token'
});
```

#### `auth_success`
Authentication successful.

```javascript
socket.on('auth_success', (data) => {
  console.log('Authenticated:', data.userId);
});
```

#### `auth_failed`
Authentication failed.

```javascript
socket.on('auth_failed', (data) => {
  console.error('Authentication failed:', data.error);
});
```

### Subscription Events

#### `subscribe`
Subscribe to channels.

```javascript
socket.emit('subscribe', {
  channels: [
    'orderbook:XLM',
    'trades',
    'user:balance',
    'market:XLM'
  ],
  filters: {
    asset: 'XLM',
    minAmount: 100
  }
});
```

#### `unsubscribe`
Unsubscribe from channels.

```javascript
socket.emit('unsubscribe', {
  channels: ['orderbook:XLM', 'trades']
});
```

### Trading Events

#### `order_book_update`
Real-time order book updates.

```javascript
socket.on('order_book_update', (message) => {
  const { asset, bids, asks, timestamp, sequence } = message.data;
  console.log(`Order book updated for ${asset}:`, { bids, asks });
});
```

#### `trade_executed`
New trade execution.

```javascript
socket.on('trade_executed', (message) => {
  const { id, asset, amount, price, type, timestamp } = message.data;
  console.log(`Trade executed: ${type} ${amount} ${asset} at ${price}`);
});
```

#### `order_placed`
New order placed.

```javascript
socket.on('order_placed', (message) => {
  const { id, userId, asset, type, amount, price } = message.data;
  console.log(`Order placed: ${type} ${amount} ${asset} at ${price}`);
});
```

#### `order_cancelled`
Order cancelled.

```javascript
socket.on('order_cancelled', (message) => {
  const { id, userId, asset } = message.data;
  console.log(`Order cancelled: ${id}`);
});
```

#### `order_filled`
Order completely filled.

```javascript
socket.on('order_filled', (message) => {
  const { id, userId, asset, amount, price } = message.data;
  console.log(`Order filled: ${id}`);
});
```

#### `order_partially_filled`
Order partially filled.

```javascript
socket.on('order_partially_filled', (message) => {
  const { id, userId, amount, remaining, price } = message.data;
  console.log(`Order partially filled: ${id}, filled: ${amount}, remaining: ${remaining}`);
});
```

### User-Specific Events

#### `user_trade_executed`
User's trade executed.

```javascript
socket.on('user_trade_executed', (message) => {
  const { id, asset, amount, price, type, fee } = message.data;
  console.log(`Your trade executed: ${type} ${amount} ${asset} at ${price}, fee: ${fee}`);
});
```

#### `user_order_update`
User's order status update.

```javascript
socket.on('user_order_update', (message) => {
  const { id, status, filled, remaining } = message.data;
  console.log(`Order ${id} updated: ${status}, filled: ${filled}, remaining: ${remaining}`);
});
```

#### `balance_update`
User's balance updated.

```javascript
socket.on('balance_update', (message) => {
  const { asset, balance, available, locked } = message.data;
  console.log(`Balance updated: ${asset} - Total: ${balance}, Available: ${available}, Locked: ${locked}`);
});
```

#### `portfolio_update`
User's portfolio updated.

```javascript
socket.on('portfolio_update', (message) => {
  const { totalValue, assets } = message.data;
  console.log(`Portfolio updated: Total value: ${totalValue}, assets:`, assets);
});
```

#### `user_achievement_unlocked`
User unlocked achievement.

```javascript
socket.on('user_achievement_unlocked', (message) => {
  const { name, description, discountBps } = message.data;
  console.log(`Achievement unlocked: ${name} - ${description}, discount: ${discountBps} bps`);
});
```

#### `user_tier_progress`
User tier progression.

```javascript
socket.on('user_tier_progress', (message) => {
  const { currentTier, nextTier, progress } = message.data;
  console.log(`Tier progress: ${currentTier} -> ${nextTier}, progress: ${progress}%`);
});
```

### Market Data Events

#### `market_data_update`
Market data update.

```javascript
socket.on('market_data_update', (message) => {
  const { asset, price, change24h, volume24h, high24h, low24h } = message.data;
  console.log(`Market data for ${asset}: $${price}, 24h change: ${change24h}%`);
});
```

#### `price_tick`
Price tick update.

```javascript
socket.on('price_tick', (message) => {
  const { asset, price, change, timestamp } = message.data;
  console.log(`Price tick: ${asset} = $${price} (${change})`);
});
```

#### `volume_update`
Volume update.

```javascript
socket.on('volume_update', (message) => {
  const { asset, volume, timestamp } = message.data;
  console.log(`Volume update: ${asset} - ${volume}`);
});
```

### System Events

#### `system_status`
System status update.

```javascript
socket.on('system_status', (message) => {
  const { status, message: statusMessage, services } = message.data;
  console.log(`System status: ${status} - ${statusMessage}`);
});
```

#### `maintenance_notice`
Maintenance notice.

```javascript
socket.on('maintenance_notice', (message) => {
  const { scheduledAt, duration, description } = message.data;
  console.log(`Maintenance scheduled: ${scheduledAt} for ${duration} - ${description}`);
});
```

### Heartbeat

#### `ping`
Server ping for connection health check.

```javascript
socket.on('ping', (message) => {
  console.log('Ping received:', message.timestamp);
  socket.emit('pong', { timestamp: new Date().toISOString() });
});
```

#### `pong`
Client pong response.

```javascript
socket.emit('pong', { timestamp: new Date().toISOString() });
```

## Channels

### Channel Patterns

#### Order Book Channels
- `orderbook:{asset}` - Order book updates for specific asset
- `orderbook:*` - All order book updates

#### Trade Channels
- `trades` - All trade executions
- `trades:{asset}` - Trades for specific asset

#### Order Channels
- `orders:{asset}` - Order updates for specific asset
- `orders:*` - All order updates

#### Market Data Channels
- `market:{asset}` - Market data for specific asset
- `market:*` - All market data

#### User Channels
- `user:{userId}` - User-specific events (requires authentication)
- `user:balance` - Balance updates
- `user:portfolio` - Portfolio updates
- `user:trades` - User's trades
- `user:orders` - User's orders

#### System Channels
- `system:status` - System status updates
- `system:maintenance` - Maintenance notices

### Channel Examples

```javascript
// Subscribe to XLM order book
socket.emit('subscribe', {
  channels: ['orderbook:XLM']
});

// Subscribe to all trades
socket.emit('subscribe', {
  channels: ['trades']
});

// Subscribe to user-specific events
socket.emit('subscribe', {
  channels: ['user:balance', 'user:portfolio', 'user:trades']
});

// Subscribe with filters
socket.emit('subscribe', {
  channels: ['trades'],
  filters: {
    asset: 'XLM',
    minAmount: 1000
  }
});
```

## Trading Namespace Specific Events

### `get_orderbook`
Request current order book.

```javascript
socket.emit('get_orderbook', { asset: 'XLM' });
```

### `get_market_data`
Request market data.

```javascript
socket.emit('get_market_data', { asset: 'XLM' });
```

### `get_user_trades`
Request user's recent trades.

```javascript
socket.emit('get_user_trades', { limit: 10 });
```

### `get_user_orders`
Request user's orders.

```javascript
socket.emit('get_user_orders', { 
  status: 'pending', 
  limit: 20 
});
```

## Error Handling

### Error Message Format

```typescript
interface ErrorMessage {
  type: 'error';
  data: {
    error: string;
    code?: string;
    details?: any;
  };
  timestamp: string;
}
```

### Common Errors

#### Authentication Errors
- `Unauthorized: No token provided`
- `Unauthorized: Invalid token`
- `Authentication required`

#### Subscription Errors
- `Invalid channel`
- `Permission denied`
- `Too many subscriptions`

#### Rate Limiting
- `Too many requests`
- `Connection rate limited`

## Rate Limiting

- **Connection Rate**: 100 connections per minute per IP
- **Message Rate**: 1000 messages per minute per connection
- **Subscription Limit**: 50 channels per connection

## Performance Optimization

### Message Compression
Messages are automatically compressed using gzip for payloads > 1KB.

### Payload Optimization
- Only send changed data
- Use numeric IDs instead of strings where possible
- Batch updates for high-frequency data

### Connection Management
- Automatic reconnection with exponential backoff
- Connection heartbeat every 30 seconds
- Automatic cleanup of inactive connections

## Client Libraries

### JavaScript/TypeScript

```bash
npm install socket.io-client
```

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3000/trading', {
  auth: { token: 'your-jwt-token' }
});

socket.on('connect', () => {
  socket.emit('subscribe', {
    channels: ['orderbook:XLM', 'trades']
  });
});

socket.on('trade_executed', (message) => {
  console.log('New trade:', message.data);
});
```

### Python

```bash
pip install socket.io-client
```

```python
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print('Connected to WebSocket')
    sio.emit('authenticate', {'token': 'your-jwt-token'})

@sio.on('trade_executed')
def on_trade_executed(data):
    print('New trade:', data)

sio.connect('http://localhost:3000/trading')
```

## Testing

### WebSocket Testing Tools

- **Socket.IO Client Tool**: Browser-based testing interface
- **Postman**: WebSocket testing support
- **wscat**: Command-line WebSocket client
- **Custom Test Scripts**: Automated testing suites

### Test Scenarios

1. **Connection Testing**
   - Basic connection/disconnection
   - Authentication flow
   - Reconnection handling

2. **Subscription Testing**
   - Subscribe/unsubscribe operations
   - Channel filtering
   - Permission validation

3. **Event Testing**
   - Message reception
   - Event ordering
   - Payload validation

4. **Performance Testing**
   - High-frequency updates
   - Multiple concurrent connections
   - Large payload handling

## Monitoring

### Metrics Available

- Connection count
- Message throughput
- Error rates
- Latency measurements
- Channel subscription counts

### Health Endpoints

- `/health` - Overall system health
- `/metrics` - Prometheus metrics
- `/websocket/stats` - WebSocket statistics

## Security

### Authentication
- JWT token validation
- Token expiration handling
- User permission verification

### Authorization
- Channel-based access control
- User-specific data filtering
- Admin-only channels

### Rate Limiting
- IP-based connection limits
- Per-user message limits
- Automatic abuse detection

## Troubleshooting

### Common Issues

#### Connection Failures
- Check JWT token validity
- Verify CORS configuration
- Check network connectivity

#### Authentication Issues
- Verify token format
- Check token expiration
- Validate user permissions

#### Performance Issues
- Monitor message frequency
- Check payload sizes
- Verify subscription counts

#### Memory Issues
- Monitor connection count
- Check for memory leaks
- Verify cleanup procedures

### Debug Mode

Enable debug logging:

```javascript
const socket = io('ws://localhost:3000', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket']
});

// Enable debug logging
localStorage.debug = 'socket.io-client:*';
```

## Best Practices

### Client Implementation
1. Implement proper error handling
2. Use exponential backoff for reconnections
3. Validate message formats
4. Handle connection state changes
5. Implement local caching for market data

### Server Implementation
1. Use connection pooling
2. Implement proper cleanup
3. Monitor performance metrics
4. Handle edge cases gracefully
5. Implement proper logging

### Performance Optimization
1. Minimize payload sizes
2. Use efficient data structures
3. Implement message batching
4. Optimize database queries
5. Use CDN for static assets

## Changelog

### v1.0.0
- Initial WebSocket API implementation
- Basic trading events
- Authentication system
- Channel subscriptions

### v1.1.0
- Added user-specific events
- Performance optimizations
- Enhanced error handling
- Rate limiting improvements

### v1.2.0
- Added market data events
- System status notifications
- Maintenance notices
- Enhanced monitoring
