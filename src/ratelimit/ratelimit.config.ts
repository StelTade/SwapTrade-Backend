/**
 * Rate Limiting Configuration
 * 
 * This file defines the rate limiting rules for the API
 */

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  name: string;
}

export const RATE_LIMIT_CONFIG = {
  GLOBAL: {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    name: 'global'
  },
  TRADING: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
    name: 'trading'
  },
  BIDDING: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
    name: 'bidding'
  },
  BALANCE: {
    limit: 50,
    windowMs: 60 * 1000, // 1 minute
    name: 'balance'
  }
};

// Endpoint path mappings for rate limiting
export const ENDPOINT_RATE_LIMIT_MAP = {
  '/trading': RATE_LIMIT_CONFIG.TRADING,
  '/trade': RATE_LIMIT_CONFIG.TRADING,
  '/bidding': RATE_LIMIT_CONFIG.BIDDING,
  '/bid': RATE_LIMIT_CONFIG.BIDDING,
  '/balance': RATE_LIMIT_CONFIG.BALANCE,
  '/wallet': RATE_LIMIT_CONFIG.BALANCE,
  // Default to global for all other endpoints
  'default': RATE_LIMIT_CONFIG.GLOBAL
};

// User role multipliers for premium users
export const USER_ROLE_MULTIPLIERS = {
  ADMIN: 2,
  STAFF: 2,
  USER: 1
};

// Rate limit header names
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After'
};

// Bypass paths (no rate limiting)
export const BYPASS_PATHS = [
  '/health',
  '/metrics',
  '/api/docs',
  '/favicon.ico'
];

// Environment-specific configurations
export const ENVIRONMENT_CONFIG = {
  development: {
    enabled: true,
    logViolations: true,
    storeType: 'memory' // or 'redis'
  },
  production: {
    enabled: true,
    logViolations: true,
    storeType: 'redis'
  },
  test: {
    enabled: false,
    logViolations: false,
    storeType: 'memory'
  }
};