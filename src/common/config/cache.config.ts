import { registerAs } from '@nestjs/config';

export default registerAs('cache', () => ({
  enabled: process.env.CACHE_ENABLED === 'true',
  ttl: {
    userBalances: parseInt(process.env.CACHE_TTL_USER_BALANCES || '30', 10), // 30 seconds
    marketPrices: parseInt(process.env.CACHE_TTL_MARKET_PRICES || '300', 10), // 5 minutes
    portfolio: parseInt(process.env.CACHE_TTL_PORTFOLIO || '60', 10), // 1 minute
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
}));