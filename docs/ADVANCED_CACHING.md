# Advanced Caching Implementation Guide

## Overview

This document describes the advanced caching system implemented in SwapTrade Backend, including cache invalidation, statistics tracking, circuit breaker pattern, and cache warming strategies.

## Features

### 1. Cache Decorators (@CacheKey, @CacheTTL)

Decorators for declarative cache control on service methods.

```typescript
@CacheKey('portfolio:{{userId}}')
@CacheTTL(60)
async getPortfolioStats(userId: string): Promise<PortfolioStatsDto> {
  // Implementation
}
```

**Parameters:**
- `@CacheKey(key: string)` - Define cache key with optional parameter interpolation using `{{paramName}}`
- `@CacheTTL(seconds: number)` - Time-to-live in seconds

**Supported Placeholders:**
- `{{userId}}` - From request user context
- `{{id}}`, `{{param}}` - From route/query parameters
- Any request property accessible via route, query, or user context

### 2. Cache Invalidation on Entity Updates

Automatically invalidate related cache keys when entities are modified.

```typescript
@InvalidateCacheKeys([
  'portfolio:{{userId}}',
  'user:balance:{{userId}}',
])
async updateBalance(userId: string, amount: number): Promise<void> {
  // Implementation
}
```

**Pattern Matching:**
- Exact keys: `'user:portfolio:123'`
- Dynamic keys: `'user:portfolio:{{userId}}'`
- Wildcard patterns: `'user:*'` (requires Redis store)

### 3. Cache Statistics Endpoint

**Endpoints:**

```
GET  /api/cache/statistics              - Overall cache stats
GET  /api/cache/statistics/top-keys     - Top performing keys
GET  /api/cache/statistics/key/:key     - Specific key stats
POST /api/cache/statistics/reset        - Reset statistics
GET  /api/cache/warming/tasks           - Warming task status
POST /api/cache/warming/trigger         - Trigger cache warming
POST /api/cache/warming/task/:task/:action - Enable/disable tasks
POST /api/cache/flush                   - Flush entire cache
GET  /api/cache/health                  - Cache health status
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "hits": 1250,
    "misses": 380,
    "errors": 12,
    "totalRequests": 1630,
    "hitRatio": 0.7668,
    "errorsByType": {
      "read": 5,
      "write": 4,
      "execution": 3
    },
    "keyStats": {
      "portfolio:user123": { "hits": 45, "misses": 15, "errors": 0 },
      "user:balance:user456": { "hits": 120, "misses": 30, "errors": 1 }
    },
    "lastUpdated": "2024-01-30T19:30:00Z"
  }
}
```

### 4. Cache Warming Scheduler

Pre-populate cache during off-peak hours to ensure high cache hit ratios.

**Scheduled Tasks:**

| Task | Schedule | Purpose |
|------|----------|---------|
| `user_balances` | Every 30 minutes | Warm frequently accessed user balance data |
| `market_data` | Every 5 minutes | Warm market prices for popular symbols |
| `full_warming` | Daily at 2 AM | Complete cache refresh cycle |

**API Control:**

```bash
# Trigger manual warming
POST /api/cache/warming/trigger

# Trigger specific task
POST /api/cache/warming/trigger?task=market_data

# Disable automatic scheduling
POST /api/cache/warming/task/market_data/disable

# Enable task
POST /api/cache/warming/task/market_data/enable
```

### 5. Circuit Breaker Pattern

Prevents cascade failures when cache is unavailable.

**States:**
- **CLOSED**: Normal operation, requests go to cache
- **OPEN**: Cache failures exceeded threshold, bypass cache to prevent further errors
- **HALF_OPEN**: Testing recovery, allow limited cache requests

**Configuration:**

```typescript
new CacheCircuitBreaker({
  failureThreshold: 5,        // Open after 5 failures
  resetTimeout: 60000,        // Try recovery after 60s
  monitorInterval: 10000,     // Check recovery every 10s
})
```

**Metrics:**

```typescript
breaker.getMetrics()
// Returns:
{
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  failureCount: 2,
  successCount: 0,
  lastFailureTime: Date | null
}
```

## Usage Examples

### Example 1: Caching User Portfolio

```typescript
@Injectable()
export class PortfolioService {
  @CacheKey('portfolio:{{userId}}')
  @CacheTTL(60)
  async getPortfolio(userId: string): Promise<Portfolio> {
    // Expensive operation - result is cached for 60 seconds
    const userBalances = await this.balanceRepository.find({ userId });
    return this.calculatePortfolioMetrics(userBalances);
  }

  @InvalidateCacheKeys(['portfolio:{{userId}}'])
  async updatePortfolio(userId: string, changes: any): Promise<void> {
    // Update logic - invalidates portfolio cache
    await this.updateUserData(userId, changes);
  }
}
```

### Example 2: Market Data Caching

```typescript
@Injectable()
export class MarketService {
  @CacheKey('market:{{symbol}}')
  @CacheTTL(300) // 5 minutes
  async getMarketPrice(symbol: string): Promise<number> {
    // Fetch from external API
    return await this.externalApi.getPrice(symbol);
  }

  async updateMarketData(symbol: string, price: number): Promise<void> {
    // Update database
    await this.saveMarketPrice(symbol, price);
    
    // Invalidate cache
    await this.cacheService.del(`market:${symbol}`);
  }
}
```

### Example 3: Using Circuit Breaker

```typescript
@Injectable()
export class CacheAwareService {
  constructor(
    private cacheService: CacheService,
    private circuitBreaker: CacheCircuitBreaker,
  ) {}

  async getData(key: string): Promise<any> {
    if (!this.circuitBreaker.canExecute()) {
      // Cache is unavailable, fetch from database
      return await this.getFromDatabase(key);
    }

    try {
      const cached = await this.cacheService.get(key);
      if (cached) {
        this.circuitBreaker.recordSuccess();
        return cached;
      }
    } catch (error) {
      this.circuitBreaker.recordFailure();
      return await this.getFromDatabase(key);
    }
  }
}
```

## Performance Benchmarks

### Target Metrics

- **Cache Hit Ratio**: > 70% for frequently accessed data
- **Performance Improvement**: > 30% reduction in response times
- **Error Rate**: < 5% of total cache operations
- **Recovery Time**: < 60 seconds for circuit breaker recovery

### Actual Results (Expected)

With proper implementation and cache warming:

```
Cache Statistics:
- Hits: 1250
- Misses: 380
- Errors: 12
- Hit Ratio: 76.68%
- Error Rate: 0.74%

Performance Impact:
- Average Response Time (without cache): 500ms
- Average Response Time (with cache): 250ms
- Improvement: 50%
```

## Best Practices

### 1. TTL Management

```typescript
// Short TTL for volatile data
@CacheTTL(30) // 30 seconds
async getRealTimeMarketData(symbol: string) { }

// Medium TTL for user data
@CacheTTL(300) // 5 minutes
async getUserPortfolio(userId: string) { }

// Long TTL for reference data
@CacheTTL(3600) // 1 hour
async getAssetList() { }
```

### 2. Cache Key Design

- Use hierarchical keys: `entity:action:identifier`
- Examples: `user:portfolio:123`, `market:price:BTC`
- Include all relevant parameters in the key

### 3. Invalidation Strategy

- Invalidate on every write/update
- Use pattern matching for related keys
- Consider cascading invalidations

```typescript
@InvalidateCacheKeys([
  'portfolio:{{userId}}',      // Direct invalidation
  'user:stats:{{userId}}:*',   // Pattern invalidation
])
async updateUserBalance(userId: string) { }
```

### 4. Monitoring

- Monitor cache hit ratio regularly
- Set alerts for low hit ratios
- Review top cache keys monthly
- Adjust TTL based on actual patterns

## Troubleshooting

### Low Hit Ratio (<50%)

**Causes:**
- TTL too short
- Cache keys too granular
- Not warming cache

**Solutions:**
- Increase TTL for non-volatile data
- Adjust cache key design
- Enable cache warming for frequently accessed data

### High Error Rate

**Causes:**
- Redis connection issues
- Memory pressure
- Timeout issues

**Solutions:**
- Check Redis connectivity
- Monitor Redis memory usage
- Adjust timeout configurations
- Enable circuit breaker

### Memory Issues

**Causes:**
- Cache too large
- Too many keys with long TTL
- Memory leaks

**Solutions:**
- Reduce TTL values
- Implement cache size limits
- Monitor key count and memory usage
- Regular cache flushing during maintenance

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache Configuration
CACHE_TTL_DEFAULT=30
CACHE_MAX_SIZE=1000000
CACHE_WARMING_ENABLED=true
```

### Module Configuration

```typescript
// In app.module.ts
@Module({
  imports: [
    CustomCacheModule,
    ScheduleModule.forRoot(),
    CommonModule,
  ],
})
export class AppModule {}
```

## API Reference

### CacheKey Decorator

```typescript
@CacheKey(key: string)
```

Define cache key for a method result.

### CacheTTL Decorator

```typescript
@CacheTTL(seconds: number)
```

Define time-to-live for cached result.

### InvalidateCacheKeys Decorator

```typescript
@InvalidateCacheKeys(keys: string[])
```

Invalidate one or more cache keys when method succeeds.

### SkipCache Decorator

```typescript
@SkipCache()
```

Skip caching for a specific method.

### CacheStatisticsService

Get cache performance metrics:
- `getStatistics()` - Overall statistics
- `getKeyStatistics(key)` - Per-key statistics
- `getTopCacheKeys(limit)` - Top keys by hit count
- `recordHit(key)` - Record cache hit
- `recordMiss(key)` - Record cache miss
- `recordError(key, type)` - Record cache error

### CacheCircuitBreaker

Prevent cascade failures:
- `canExecute()` - Check if operation allowed
- `recordSuccess()` - Record successful operation
- `recordFailure()` - Record failed operation
- `getState()` - Get current state
- `getMetrics()` - Get performance metrics
- `reset()` - Reset to CLOSED state

## Related Documentation

- [Cache Service Documentation](./cache-service.md)
- [Performance Optimization Guide](../docs/PERFORMANCE_OPTIMIZATION.md)
- [Error Handling Guide](../docs/ERROR_HANDLING.md)
