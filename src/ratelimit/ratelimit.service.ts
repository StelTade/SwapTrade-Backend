/**
 * Rate Limiting Service
 * 
 * This service handles rate limiting logic and can be implemented
 * with different storage backends (memory, Redis, etc.)
 */

import { RATE_LIMIT_CONFIG, USER_ROLE_MULTIPLIERS, RATE_LIMIT_HEADERS, BYPASS_PATHS } from './ratelimit.config';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class RateLimitService {
  private store: Map<string, RateLimitRecord> = new Map();

  /**
   * Check if request should be rate limited
   * @param userId User ID (if authenticated)
   * @param ip Client IP address
   * @param endpoint Endpoint path
   * @param userRole User role for multiplier calculation
   * @returns Object with limit status and headers
   */
  checkRateLimit(userId: string | null, ip: string, endpoint: string, userRole?: string) {
    // Check if path should be bypassed
    if (this.shouldBypass(endpoint)) {
      return { allowed: true, headers: {} };
    }

    const limitConfig = this.getEndpointLimit(endpoint);
    const tracker = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `${limitConfig.name}:${tracker}`;
    const multiplier = this.getUserMultiplier(userRole);
    const actualLimit = limitConfig.limit * multiplier;
    
    const now = Date.now();

    // Cleanup expired records
    this.cleanupExpiredRecords(now);

    // Get or create rate limit record
    let record = this.store.get(key);
    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime: now + limitConfig.windowMs,
      };
      this.store.set(key, record);
    }

    // Increment counter
    record.count++;

    // Prepare response headers
    const remaining = Math.max(0, actualLimit - record.count);
    const headers = {
      [RATE_LIMIT_HEADERS.LIMIT]: actualLimit,
      [RATE_LIMIT_HEADERS.REMAINING]: remaining,
      [RATE_LIMIT_HEADERS.RESET]: record.resetTime,
      [RATE_LIMIT_HEADERS.RETRY_AFTER]: Math.ceil((record.resetTime - now) / 1000)
    };

    const allowed = record.count <= actualLimit;

    return { allowed, headers, retryAfter: headers[RATE_LIMIT_HEADERS.RETRY_AFTER] };
  }

  /**
   * Get rate limit configuration for endpoint
   */
  private getEndpointLimit(endpoint: string) {
    // Simple path matching - can be enhanced with regex or more sophisticated routing
    if (endpoint.includes('/trading') || endpoint.includes('/trade')) {
      return RATE_LIMIT_CONFIG.TRADING;
    }
    if (endpoint.includes('/bidding') || endpoint.includes('/bid')) {
      return RATE_LIMIT_CONFIG.BIDDING;
    }
    if (endpoint.includes('/balance') || endpoint.includes('/wallet')) {
      return RATE_LIMIT_CONFIG.BALANCE;
    }
    return RATE_LIMIT_CONFIG.GLOBAL;
  }

  /**
   * Get user multiplier based on role
   */
  private getUserMultiplier(role?: string): number {
    if (!role) return USER_ROLE_MULTIPLIERS.USER;
    
    return USER_ROLE_MULTIPLIERS[role as keyof typeof USER_ROLE_MULTIPLIERS] || 
           USER_ROLE_MULTIPLIERS.USER;
  }

  /**
   * Check if endpoint should bypass rate limiting
   */
  private shouldBypass(endpoint: string): boolean {
    return BYPASS_PATHS.some(path => endpoint.startsWith(path));
  }

  /**
   * Cleanup expired rate limit records
   */
  private cleanupExpiredRecords(now: number): void {
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  resetRateLimit(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get current rate limit stats for monitoring
   */
  getStats(): { totalKeys: number; activeRecords: number } {
    const now = Date.now();
    let activeRecords = 0;
    
    for (const record of this.store.values()) {
      if (record.resetTime > now) {
        activeRecords++;
      }
    }
    
    return {
      totalKeys: this.store.size,
      activeRecords
    };
  }
}