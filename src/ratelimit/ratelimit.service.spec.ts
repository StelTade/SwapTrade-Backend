/**
 * Unit tests for RateLimitService
 * 
 * Tests the core rate limiting logic including:
 * - Global rate limiting (100 req/15min per IP)
 * - Endpoint-specific limits (trading, bidding, balance)
 * - User-based limits (premium vs free tier)
 * - Rate limit headers
 * - Bypass functionality
 */

import { RateLimitService } from '../ratelimit.service';
import { RATE_LIMIT_CONFIG, USER_ROLE_MULTIPLIERS } from '../ratelimit.config';

describe('RateLimitService', () => {
  let rateLimitService: RateLimitService;

  beforeEach(() => {
    rateLimitService = new RateLimitService();
  });

  afterEach(() => {
    // Clear all rate limit records between tests
    jest.restoreAllMocks();
  });

  describe('Global Rate Limiting', () => {
    it('should allow requests within global limit (100 req/15min)', () => {
      const ip = '192.168.1.1';
      const endpoint = '/api/test';
      
      // Make 99 requests (within limit)
      for (let i = 0; i < 99; i++) {
        const result = rateLimitService.checkRateLimit(null, ip, endpoint);
        expect(result.allowed).toBe(true);
      }
      
      // 100th request should still be allowed
      const result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
      
      // 101st request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(blockedResult.allowed).toBe(false);
    });

    it('should reset counters after window expires', (done) => {
      const ip = '192.168.1.2';
      const endpoint = '/api/test';
      
      // Mock time to control window expiration
      const originalDateNow = Date.now;
      const startTime = Date.now();
      
      // Make requests to reach limit
      for (let i = 0; i < 100; i++) {
        rateLimitService.checkRateLimit(null, ip, endpoint);
      }
      
      // Next request should be blocked
      let result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(false);
      
      // Simulate time passage (advance beyond window)
      jest.spyOn(global.Date, 'now').mockImplementation(() => 
        startTime + RATE_LIMIT_CONFIG.GLOBAL.windowMs + 1000
      );
      
      // Request should now be allowed (counter reset)
      result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
      done();
    });
  });

  describe('Endpoint-Specific Limits', () => {
    it('should enforce trading endpoint limit (10 req/min)', () => {
      const ip = '192.168.1.3';
      const endpoint = '/trading/order';
      
      // Make 9 requests (within limit)
      for (let i = 0; i < 9; i++) {
        const result = rateLimitService.checkRateLimit(null, ip, endpoint);
        expect(result.allowed).toBe(true);
      }
      
      // 10th request should still be allowed
      const result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
      
      // 11th request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(blockedResult.allowed).toBe(false);
    });

    it('should enforce bidding endpoint limit (20 req/min)', () => {
      const ip = '192.168.1.4';
      const endpoint = '/bidding/create';
      
      // Make 19 requests (within limit)
      for (let i = 0; i < 19; i++) {
        const result = rateLimitService.checkRateLimit(null, ip, endpoint);
        expect(result.allowed).toBe(true);
      }
      
      // 20th request should still be allowed
      const result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
      
      // 21st request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(blockedResult.allowed).toBe(false);
    });

    it('should enforce balance endpoint limit (50 req/min)', () => {
      const ip = '192.168.1.5';
      const endpoint = '/balance/check';
      
      // Make 49 requests (within limit)
      for (let i = 0; i < 49; i++) {
        const result = rateLimitService.checkRateLimit(null, ip, endpoint);
        expect(result.allowed).toBe(true);
      }
      
      // 50th request should still be allowed
      const result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
      
      // 51st request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('User-Based Rate Limiting', () => {
    it('should give premium users 2x limits', () => {
      const userId = 'premium-user-1';
      const endpoint = '/trading/order';
      
      // Premium user should get 20 requests (2x trading limit)
      for (let i = 0; i < 19; i++) {
        const result = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'ADMIN');
        expect(result.allowed).toBe(true);
      }
      
      // 20th request should still be allowed
      const result = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'ADMIN');
      expect(result.allowed).toBe(true);
      
      // 21st request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'ADMIN');
      expect(blockedResult.allowed).toBe(false);
    });

    it('should apply standard limits for regular users', () => {
      const userId = 'regular-user-1';
      const endpoint = '/trading/order';
      
      // Regular user should get standard 10 requests
      for (let i = 0; i < 9; i++) {
        const result = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'USER');
        expect(result.allowed).toBe(true);
      }
      
      // 10th request should still be allowed
      const result = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'USER');
      expect(result.allowed).toBe(true);
      
      // 11th request should be blocked
      const blockedResult = rateLimitService.checkRateLimit(userId, '127.0.0.1', endpoint, 'USER');
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include proper rate limit headers in response', () => {
      const ip = '192.168.1.6';
      const endpoint = '/api/test';
      
      const result = rateLimitService.checkRateLimit(null, ip, endpoint);
      
      expect(result.headers).toBeDefined();
      expect(result.headers['X-RateLimit-Limit']).toBe(RATE_LIMIT_CONFIG.GLOBAL.limit);
      expect(result.headers['X-RateLimit-Remaining']).toBeLessThanOrEqual(RATE_LIMIT_CONFIG.GLOBAL.limit);
      expect(result.headers['X-RateLimit-Reset']).toBeDefined();
      expect(result.headers['Retry-After']).toBeDefined();
    });

    it('should show decreasing remaining count', () => {
      const ip = '192.168.1.7';
      const endpoint = '/api/test';
      const limit = RATE_LIMIT_CONFIG.GLOBAL.limit;
      
      // First request
      let result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.headers['X-RateLimit-Remaining']).toBe(limit - 1);
      
      // Second request
      result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.headers['X-RateLimit-Remaining']).toBe(limit - 2);
    });
  });

  describe('Bypass Functionality', () => {
    it('should bypass rate limiting for health check endpoints', () => {
      const ip = '192.168.1.8';
      
      // Make many requests to health endpoint
      for (let i = 0; i < 200; i++) {
        const result = rateLimitService.checkRateLimit(null, ip, '/health');
        expect(result.allowed).toBe(true);
        expect(Object.keys(result.headers)).toHaveLength(0); // No headers for bypassed requests
      }
    });

    it('should bypass rate limiting for metrics endpoints', () => {
      const ip = '192.168.1.9';
      
      const result = rateLimitService.checkRateLimit(null, ip, '/metrics');
      expect(result.allowed).toBe(true);
      expect(Object.keys(result.headers)).toHaveLength(0);
    });

    it('should bypass rate limiting for API documentation', () => {
      const ip = '192.168.1.10';
      
      const result = rateLimitService.checkRateLimit(null, ip, '/api/docs');
      expect(result.allowed).toBe(true);
      expect(Object.keys(result.headers)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple IPs independently', () => {
      const endpoint = '/api/test';
      
      // IP 1 reaches limit
      for (let i = 0; i < 100; i++) {
        rateLimitService.checkRateLimit(null, '192.168.1.11', endpoint);
      }
      
      // IP 2 should still be able to make requests
      const result = rateLimitService.checkRateLimit(null, '192.168.1.12', endpoint);
      expect(result.allowed).toBe(true);
    });

    it('should handle multiple users independently', () => {
      const endpoint = '/api/test';
      
      // User 1 reaches limit
      for (let i = 0; i < 100; i++) {
        rateLimitService.checkRateLimit('user-1', '127.0.0.1', endpoint);
      }
      
      // User 2 should still be able to make requests
      const result = rateLimitService.checkRateLimit('user-2', '127.0.0.1', endpoint);
      expect(result.allowed).toBe(true);
    });

    it('should handle invalid user roles gracefully', () => {
      const ip = '192.168.1.13';
      const endpoint = '/api/test';
      
      // Should fall back to USER multiplier for invalid roles
      const result = rateLimitService.checkRateLimit(null, ip, endpoint, 'INVALID_ROLE');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      // Make some requests
      rateLimitService.checkRateLimit('user-1', '127.0.0.1', '/api/test-1');
      rateLimitService.checkRateLimit('user-2', '127.0.0.1', '/api/test-2');
      rateLimitService.checkRateLimit(null, '192.168.1.14', '/api/test-3');
      
      const stats = rateLimitService.getStats();
      expect(stats.totalKeys).toBeGreaterThanOrEqual(3);
      expect(stats.activeRecords).toBeGreaterThanOrEqual(3);
    });

    it('should allow resetting specific rate limits', () => {
      const ip = '192.168.1.15';
      const endpoint = '/api/test';
      const key = `global:ip:${ip}`;
      
      // Reach limit
      for (let i = 0; i < 100; i++) {
        rateLimitService.checkRateLimit(null, ip, endpoint);
      }
      
      // Should be blocked
      let result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(false);
      
      // Reset the limit
      rateLimitService.resetRateLimit(key);
      
      // Should be allowed again
      result = rateLimitService.checkRateLimit(null, ip, endpoint);
      expect(result.allowed).toBe(true);
    });
  });
});