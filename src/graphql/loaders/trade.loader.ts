import { Injectable } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { Trade } from '../../trading/entities/trade.entity';
import { TradingService } from '../../trading/trading.service';

@Injectable()
export class TradeLoader {
  constructor(private readonly tradingService: TradingService) {}

  /**
   * DataLoader for user trades - batches individual user trade requests
   * Reduces N+1 queries when fetching trades for multiple users
   */
  readonly userTradesLoader = new DataLoader(
    async (userIds: readonly string[]) => {
      const startTime = Date.now();

      // Batch fetch all trades for all users in a single query
      const tradesByUser = await this.tradingService.getTradesForUsers(userIds);

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded trades for ${userIds.length} users in ${duration}ms`,
      );

      // Return results in the same order as input keys
      return userIds.map((userId) => tradesByUser[userId] || []);
    },
  );

  /**
   * DataLoader for asset trades - batches trade requests by asset
   * Useful for market data and analytics
   */
  readonly assetTradesLoader = new DataLoader(
    async (assets: readonly string[]) => {
      const startTime = Date.now();

      const tradesByAsset =
        await this.tradingService.getTradesForAssets(assets);

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded trades for ${assets.length} assets in ${duration}ms`,
      );

      return assets.map((asset) => tradesByAsset[asset] || []);
    },
  );

  /**
   * DataLoader for trade by ID - batches individual trade lookups
   */
  readonly tradeByIdLoader = new DataLoader(
    async (tradeIds: readonly number[]) => {
      const startTime = Date.now();

      const trades = await this.tradingService.getTradesByIds(tradeIds);

      const duration = Date.now() - startTime;
      console.log(`Batch loaded ${tradeIds.length} trades in ${duration}ms`);

      return tradeIds.map(
        (id) => trades.find((trade) => trade.id === id) || null,
      );
    },
  );

  /**
   * Clear cache for specific user trades
   */
  clearUserTrades(userId: string): void {
    this.userTradesLoader.clear(userId);
  }

  /**
   * Clear cache for specific asset trades
   */
  clearAssetTrades(asset: string): void {
    this.assetTradesLoader.clear(asset);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.userTradesLoader.clearAll();
    this.assetTradesLoader.clearAll();
    this.tradeByIdLoader.clearAll();
  }
}
