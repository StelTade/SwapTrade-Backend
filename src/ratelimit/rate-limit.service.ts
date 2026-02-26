import { Injectable, Logger } from '@nestjs/common';
import { RedisPoolService } from '../common/cache/redis-pool.service';
import { ConfigService } from '../config/config.service';
import { MetricsService } from '../common/logging/metrics_service';

interface CheckResult {
  allowed: boolean;
  remaining: number;
  reset: number; // seconds
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // Lua script implementing token bucket (atomic)
  private tokenBucketLua = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last')
local tokens = tonumber(data[1])
local last = tonumber(data[2])
if not tokens then tokens = capacity end
if not last then last = now end

local delta = math.max(0, now - last)
local refill = delta * refill_per_ms
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local remaining = tokens
local reset = 0

if tokens >= requested then
  allowed = 1
  tokens = tokens - requested
  remaining = tokens
  redis.call('HMSET', key, 'tokens', tokens, 'last', now)
  redis.call('PEXPIRE', key, math.ceil((capacity / refill_per_ms) * 2))
else
  allowed = 0
  if refill_per_ms > 0 then
    reset = math.ceil((requested - tokens) / refill_per_ms / 1000)
  else
    reset = 1
  end
  redis.call('HMSET', key, 'tokens', tokens, 'last', now)
  redis.call('PEXPIRE', key, math.ceil((capacity / refill_per_ms) * 2))
end

return {allowed, tostring(remaining), tostring(reset)}
`;

  constructor(
    private readonly pool: RedisPoolService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  private async runTokenBucket(key: string, capacity: number, refillPerSecond: number, requested = 1): Promise<CheckResult> {
    const refillPerMs = refillPerSecond / 1000;
    const now = Date.now();

    try {
      const res = await this.pool.withClient(async (client) => {
        // EVAL with 1 key
        const raw = await client.eval(this.tokenBucketLua, 1, key, capacity, refillPerMs, now, requested);
        return raw as any;
      });

      const allowed = Number(res[0]) === 1;
      const remaining = Number(res[1]) || 0;
      const reset = Number(res[2]) || 0;

      return { allowed, remaining, reset };
    } catch (err) {
      this.logger.warn('Token bucket Lua script failed, falling back to sliding window', (err as Error).message);
      // Fallback to sliding window
      return this.runSlidingWindowFallback(key, capacity + 0, this.config.rateLimit?.windowMs ?? 60000, requested);
    }
  }

  private async runSlidingWindowFallback(key: string, maxRequests: number, windowMs: number, _requested = 1): Promise<CheckResult> {
    // Use sorted set with timestamps
    const zkey = `${key}:sw`;
    const now = Date.now();
    const windowStart = now - windowMs;

    return this.pool.withClient(async (client) => {
      await client.zremrangebyscore(zkey, 0, windowStart);
      await client.zadd(zkey, now, `${now}:${Math.random()}`);
      await client.pexpire(zkey, windowMs * 2);
      const count = await client.zcount(zkey, windowStart, now);
      const allowed = count <= maxRequests;
      const remaining = Math.max(0, maxRequests - count);
      const reset = Math.ceil((windowMs) / 1000);
      return { allowed, remaining, reset };
    });
  }

  /**
   * Check rate limit for an identifier and endpoint
   */
  async check(identifier: string, endpoint: string, opts?: { points?: number; refillPerSecond?: number; burst?: number; }): Promise<CheckResult> {
    const cfg = this.config.rateLimit;
    const points = opts?.points ?? cfg?.maxRequests ?? 100;
    const refillPerSecond = opts?.refillPerSecond ?? Math.max(1, Math.floor(points / ((cfg?.windowMs ?? 60000) / 1000)));
    const burst = opts?.burst ?? Math.max(points, 1);

    const key = `ratelimit:${endpoint}:${identifier}`;
    const result = await this.runTokenBucket(key, burst, refillPerSecond, 1);

    if (!result.allowed) {
      // record metric for violation
      try { this.metrics.recordError(endpoint, 429); } catch {}
    }

    return result;
  }
}

export { CheckResult };
