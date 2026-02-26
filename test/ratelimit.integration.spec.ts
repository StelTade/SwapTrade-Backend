import Redis from 'ioredis';

const tokenBucketLua = `
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

describe('Distributed Rate Limiter (integration)', () => {
  const redis = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) });
  const key = `test:ratelimit:integration:${Date.now()}:${Math.random()}`;

  afterAll(async () => {
    await redis.quit();
  });

  it('enforces token bucket across simulated instances', async () => {
    const capacity = 5;
    const refillPerSecond = 0; // no refill for test
    const refillPerMs = refillPerSecond / 1000;

    // perform capacity requests - should be allowed
    for (let i = 0; i < capacity; i++) {
      const now = Date.now();
      const res: any = await redis.eval(tokenBucketLua, 1, key, capacity, refillPerMs, now, 1);
      expect(Number(res[0])).toBe(1);
    }

    // next request should be blocked
    const now = Date.now();
    const res: any = await redis.eval(tokenBucketLua, 1, key, capacity, refillPerMs, now, 1);
    expect(Number(res[0])).toBe(0);
  }, 20000);
});
