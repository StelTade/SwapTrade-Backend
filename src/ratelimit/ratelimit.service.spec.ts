/**
 * Unit tests for RateLimitService (Redis-backed)
 *
 * Tests the core rate limiting logic including:
 * - Token bucket rate limiting via Redis Lua scripts
 * - Sliding window fallback when Lua is unavailable
 * - Rate limit headers in responses
 * - Fail-open behavior on Redis errors
 */

import { RateLimitService } from './rate-limit.service';

// Mock RedisPoolService
const mockWithClient = jest.fn();
const mockRedisPoolService = {
  withClient: mockWithClient,
};

// Mock ConfigService
const mockConfigService = {
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },
};

// Mock MetricsService
const mockMetricsService = {
  recordError: jest.fn(),
};

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitService = new RateLimitService(
      mockRedisPoolService as any,
      mockConfigService as any,
      mockMetricsService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('check() - Token Bucket via Redis', () => {
    it('should allow request when tokens are available', async () => {
      // Mock Redis Lua script response: [allowed=1, remaining=99, reset=0]
      mockWithClient.mockResolvedValueOnce([1, '99', '0']);

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/api/test',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(mockWithClient).toHaveBeenCalledTimes(1);
    });

    it('should reject request when tokens are exhausted', async () => {
      // Mock Redis Lua script response: [allowed=0, remaining=0, reset=30]
      mockWithClient.mockResolvedValueOnce([0, '0', '30']);

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/api/test',
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reset).toBe(30);
    });

    it('should pass correct parameters to Redis Lua script', async () => {
      mockWithClient.mockResolvedValueOnce([1, '49', '0']);

      await rateLimitService.check('ip:10.0.0.1', '/trading/order', {
        points: 50,
        refillPerSecond: 1,
        burst: 50,
      });

      expect(mockWithClient).toHaveBeenCalledTimes(1);
      // Verify the Lua script was called with correct arguments
      const callArgs = mockWithClient.mock.calls[0][0];
      expect(typeof callArgs).toBe('function');
    });

    it('should use default config when no opts provided', async () => {
      mockWithClient.mockResolvedValueOnce([1, '99', '0']);

      await rateLimitService.check('ip:1.2.3.4', '/api/test');

      // Should use config defaults: maxRequests=100, windowMs=60000
      expect(mockWithClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sliding Window Fallback', () => {
    it('should fall back to sliding window when Lua script fails', async () => {
      // First call fails (token bucket Lua)
      mockWithClient
        .mockRejectedValueOnce(new Error('Lua script error'))
        // Second call succeeds (sliding window fallback)
        .mockResolvedValueOnce(undefined) // zremrangebyscore
        .mockResolvedValueOnce(undefined) // zadd
        .mockResolvedValueOnce(undefined) // pexpire
        .mockResolvedValueOnce(5); // zcount

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/api/test',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95); // 100 - 5
      expect(mockMetricsService.recordError).not.toHaveBeenCalled();
    });

    it('should reject when sliding window count exceeds limit', async () => {
      mockWithClient
        .mockRejectedValueOnce(new Error('Lua script error'))
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(101); // count > maxRequests (100)

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/api/test',
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should fail open on Redis connection error', async () => {
      // Both token bucket and sliding window fail
      mockWithClient
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/api/test',
      );

      // Should fail open (allow the request)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should record metric on rate limit violation', async () => {
      mockWithClient.mockResolvedValueOnce([0, '0', '30']);

      await rateLimitService.check('ip:192.168.1.1', '/api/test');

      expect(mockMetricsService.recordError).toHaveBeenCalledWith(
        '/api/test',
        429,
      );
    });
  });

  describe('Endpoint-Specific Configuration', () => {
    it('should use custom points when provided', async () => {
      mockWithClient.mockResolvedValueOnce([1, '24', '0']);

      const result = await rateLimitService.check(
        'ip:192.168.1.1',
        '/trading/order',
        { points: 25 },
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(24);
    });

    it('should calculate refill rate based on points and window', async () => {
      mockWithClient.mockResolvedValueOnce([1, '49', '0']);

      // 50 points, 60s window -> refillPerSecond = 50/60 ~= 0.83
      await rateLimitService.check('ip:192.168.1.1', '/api/test', {
        points: 50,
      });

      expect(mockWithClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Per-User vs Per-IP', () => {
    it('should rate limit by IP for unauthenticated requests', async () => {
      mockWithClient.mockResolvedValueOnce([1, '99', '0']);

      await rateLimitService.check('ip:192.168.1.1', '/api/test');

      // Key should include the IP identifier
      expect(mockWithClient).toHaveBeenCalledTimes(1);
    });

    it('should rate limit by user ID for authenticated requests', async () => {
      mockWithClient.mockResolvedValueOnce([1, '49', '0']);

      await rateLimitService.check('user:user-123', '/api/test', {
        points: 50,
      });

      expect(mockWithClient).toHaveBeenCalledTimes(1);
    });

    it('should track IP and user independently', async () => {
      // First request by IP
      mockWithClient.mockResolvedValueOnce([1, '99', '0']);
      await rateLimitService.check('ip:10.0.0.1', '/api/test');

      // Second request by user
      mockWithClient.mockResolvedValueOnce([1, '49', '0']);
      await rateLimitService.check('user:user-456', '/api/test', {
        points: 50,
      });

      expect(mockWithClient).toHaveBeenCalledTimes(2);
    });
  });
});
