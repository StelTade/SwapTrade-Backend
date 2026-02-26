import { Inject, SetMetadata } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export const CacheTTL = (ttl: number) => SetMetadata('cache_ttl', ttl);

// Decorator for user balance caching (30 seconds TTL)
export const UserBalanceCache = () => CacheTTL(30);

// Decorator for market price caching (5 minutes TTL)
export const MarketPriceCache = () => CacheTTL(300);

// Decorator for portfolio summary caching (1 minute TTL)
export const PortfolioCache = () => CacheTTL(60);