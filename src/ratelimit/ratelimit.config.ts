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
    name: 'global',
  },
  TRADING: {
    limit: 10,
    windowMs: 60 * 1000, // 1 minute
    name: 'trading',
  },
  BOT_TRADING: {
    limit: 5,
    windowMs: 60 * 1000, // 1 minute
    name: 'bot_trading',
  },
  BIDDING: {
    limit: 20,
    windowMs: 60 * 1000, // 1 minute
    name: 'bidding',
  },
  BALANCE: {
    limit: 50,
    windowMs: 60 * 1000, // 1 minute
    name: 'balance',
  },
  INSTITUTIONAL_BULK_TRADE: {
    limit: 1000,
    windowMs: 1 * 1000, // 1 second — supports 1000+ trades/sec
    name: 'institutional_bulk_trade',
  },
  INSTITUTIONAL_API: {
    limit: 5000,
    windowMs: 1 * 1000, // 1 second — high-throughput institutional API
    name: 'institutional_api',
  },
  INSTITUTIONAL_REPORTING: {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute
    name: 'institutional_reporting',
  },
};

// Endpoint path mappings for rate limiting
export const ENDPOINT_RATE_LIMIT_MAP = {
  '/trading': RATE_LIMIT_CONFIG.TRADING,
  '/trade': RATE_LIMIT_CONFIG.TRADING,
  '/bot/trading': RATE_LIMIT_CONFIG.BOT_TRADING,
  '/bot/trade': RATE_LIMIT_CONFIG.BOT_TRADING,
  '/bidding': RATE_LIMIT_CONFIG.BIDDING,
  '/bid': RATE_LIMIT_CONFIG.BIDDING,
  '/balance': RATE_LIMIT_CONFIG.BALANCE,
  '/wallet': RATE_LIMIT_CONFIG.BALANCE,
  '/institutional/bulk-trade': RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE,
  '/institutional/trades/bulk': RATE_LIMIT_CONFIG.INSTITUTIONAL_BULK_TRADE,
  '/institutional/reports': RATE_LIMIT_CONFIG.INSTITUTIONAL_REPORTING,
  '/institutional/reconciliation': RATE_LIMIT_CONFIG.INSTITUTIONAL_REPORTING,
  // Default to global for all other endpoints
  default: RATE_LIMIT_CONFIG.GLOBAL,
};

// User role multipliers for premium users
export const USER_ROLE_MULTIPLIERS = {
  ADMIN: 5,
  STAFF: 3,
  PREMIUM: 2,
  INSTITUTIONAL_CLIENT: 10,
  USER: 1,
};

// Rate limit header names
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
};

// Bypass paths (no rate limiting)
export const BYPASS_PATHS = [
  '/health',
  '/metrics',
  '/api/docs',
  '/favicon.ico',
];

// Environment-specific configurations
export const ENVIRONMENT_CONFIG = {
  development: {
    enabled: true,
    logViolations: true,
    storeType: 'memory', // or 'redis'
  },
  production: {
    enabled: true,
    logViolations: true,
    storeType: 'redis',
  },
  test: {
    enabled: false,
    logViolations: false,
    storeType: 'memory',
  },
};
