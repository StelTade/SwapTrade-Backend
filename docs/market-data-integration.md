# Market Data Integration Documentation

## Overview

The Market Data Integration system provides real-time and historical market data from external providers (Binance, Coinbase) with built-in validation, caching, and failover mechanisms.

## Architecture

### Components

1. **Market Data Providers** (`src/market-data/providers/`)
   - `BinanceProvider`: WebSocket integration with Binance API
   - `CoinbaseProvider`: WebSocket integration with Coinbase API
   - Both support REST API fallback

2. **Market Data Service** (`src/market-data/market-data.service.ts`)
   - Orchestrates multiple providers
   - Handles data validation and storage
   - Manages caching and failover logic

3. **Data Validation** (`src/market-data/services/market-data-validator.service.ts`)
   - Validates incoming market data
   - Sanitizes and normalizes data formats
   - Price range validation

4. **Market Data Controller** (`src/market-data/market-data.controller.ts`)
   - REST API endpoints for market data
   - Subscription management
   - Health monitoring

## Features

### Real-time Data Streaming
- WebSocket connections to multiple exchanges
- Automatic reconnection with exponential backoff
- Subscription management for specific trading pairs

### Data Validation & Sanitization
- Input validation using class-validator
- Price range validation per asset
- Data sanitization to prevent injection attacks
- Timestamp normalization

### Caching Strategy
- Redis-based caching for frequently accessed data
- 60-second TTL for market data
- Cache warming on service startup

### Failover Mechanism
- Primary/fallback provider architecture
- Automatic failover on connection issues
- Health checks every 5 minutes
- REST API fallback when WebSocket fails

## API Endpoints

### GET /market-data
Retrieve current market data
- Query Parameters:
  - `symbol` (optional): Filter by specific asset
- Response: Array of market data objects

### GET /market-data/historical
Retrieve historical market data
- Query Parameters:
  - `symbol` (required): Asset symbol
  - `fromDate` (required): Start date (ISO string)
  - `toDate` (required): End date (ISO string)
- Response: Array of historical market data

### POST /market-data/subscribe
Subscribe to real-time updates for specific pairs
- Body: `{ "pairs": ["BTCUSDT", "ETHUSDT"] }`
- Response: Subscription confirmation

### POST /market-data/unsubscribe
Unsubscribe from real-time updates
- Body: `{ "pairs": ["BTCUSDT", "ETHUSDT"] }`
- Response: Unsubscription confirmation

### GET /market-data/health
Check service health and provider status
- Response: Health status and provider connectivity

## Configuration

### Environment Variables
```env
MARKET_DATA_PROVIDERS=binance,coinbase
MARKET_DATA_UPDATE_INTERVAL=1000
MARKET_DATA_CACHE_TTL=60
MARKET_DATA_MAX_RETRIES=3
MARKET_DATA_RETRY_DELAY=5000
```

### Provider Configuration
Each provider can be configured with:
- WebSocket URL
- API key (if required)
- Supported trading pairs
- Update interval

## Data Model

### MarketData Entity
```typescript
{
  id: number;
  asset: string;
  currentPrice: number;
  previousPrice: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  poolReserveA: number;
  poolReserveB: number;
  feeRate: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- Fallback to REST API
- Provider rotation

### Data Validation Errors
- Invalid data is logged and discarded
- Price out of range warnings
- Malformed message handling

### Service Outages
- Graceful degradation
- Cached data serving
- Health monitoring

## Monitoring

### Health Checks
- Provider connectivity status
- Data freshness validation
- Cache hit/miss ratios

### Logging
- Connection events
- Data validation failures
- Performance metrics

## Security

### Data Validation
- Input sanitization
- SQL injection prevention
- XSS protection

### Rate Limiting
- API endpoint rate limiting
- WebSocket connection limits
- Subscription throttling

## Performance

### Optimization Strategies
- Connection pooling
- Batch database updates
- Efficient caching
- Minimal memory footprint

### Metrics
- Latency measurements
- Throughput monitoring
- Error rate tracking

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   - Check network connectivity
   - Verify provider URLs
   - Review firewall settings

2. **Data Validation Errors**
   - Check provider data format
   - Review validation rules
   - Monitor price range settings

3. **Cache Issues**
   - Verify Redis connectivity
   - Check TTL settings
   - Monitor cache size

### Debug Logging
Enable debug logging for detailed troubleshooting:
```env
LOG_LEVEL=debug
```

## Future Enhancements

1. **Additional Providers**
   - Kraken integration
   - Huobi integration
   - Custom provider support

2. **Advanced Features**
   - Price prediction
   - Volume analysis
   - Market sentiment

3. **Performance Improvements**
   - Data compression
   - Connection multiplexing
   - Edge caching
