import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKey, InvalidateCacheKeys } from '../decorators/cache-key.decorator';
import { CacheTTL } from '../decorators/cache.decorators';
import { Balance } from '../../balance/balance.entity';

/**
 * Example service showing advanced caching patterns
 * This demonstrates how to use @CacheKey and @InvalidateCacheKeys decorators
 */
@Injectable()
export class CachingExampleService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  /**
   * Example: Cached method with dynamic key based on userId
   * Cache key: portfolio:123 (if userId=123)
   * TTL: 60 seconds
   */
  @CacheKey('portfolio:{{userId}}')
  @CacheTTL(60)
  async getPortfolioStats(userId: string): Promise<any> {
    const balances = await this.balanceRepository.find({
      where: { userId },
    });

    return {
      userId,
      totalBalance: balances.reduce((sum, b) => sum + Number(b.balance), 0),
      assets: balances.length,
    };
  }

  /**
   * Example: Method that invalidates related caches on update
   * When called, it invalidates:
   * - portfolio:123 (user's portfolio)
   * - user:balance:123 (user's balance)
   */
  @InvalidateCacheKeys([
    'portfolio:{{userId}}',
    'user:balance:{{userId}}',
  ])
  @CacheTTL(30)
  async updateBalance(
    userId: string,
    assetId: string,
    amount: number,
  ): Promise<Balance | null> {
    const balance = await this.balanceRepository.findOne({
      where: { userId, asset: assetId },
    });

    if (balance) {
      balance.balance = Number(balance.balance) + amount;
      return await this.balanceRepository.save(balance);
    }

    return null;
  }

  /**
   * Example: Market data caching with longer TTL
   * Cache key: market:BTC
   * TTL: 300 seconds (5 minutes)
   */
  @CacheKey('market:{{symbol}}')
  @CacheTTL(300)
  async getMarketPrice(symbol: string): Promise<number> {
    // In production, this would fetch from an external API
    return Math.random() * 50000; // Placeholder
  }

  /**
   * Example: Invalidate pattern-based caches
   * When user's wallet is updated, invalidate all related caches
   */
  @InvalidateCacheKeys([
    'portfolio:{{userId}}',
    'user:balance:{{userId}}',
    'wallet:{{userId}}:*',
  ])
  async syncWallet(userId: string): Promise<void> {
    // Sync logic here
    console.log(`Synced wallet for user: ${userId}`);
  }
}
