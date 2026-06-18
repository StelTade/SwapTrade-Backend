import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import { TradingService } from '../../trading/trading.service';
import { Trade } from '../../trading/entities/trade.entity';
import { TradeLoader } from '../loaders/trade.loader';

@Resolver()
export class OptimizedTradeResolver {
  constructor(
    private readonly tradingService: TradingService,
    private readonly tradeLoader: TradeLoader,
  ) {}

  @Mutation(() => Trade)
  async executeTrade(
    @Args('userId') userId: number,
    @Args('asset') asset: string,
    @Args('amount') amount: number,
    @Args('price') price: number,
    @Args('type') type: string,
    @Context() context: { req: any },
  ): Promise<Trade> {
    const startTime = process.memoryUsage();

    try {
      const result = await this.tradingService.swap(
        userId,
        asset,
        amount,
        price,
        type,
      );

      if (!result.success || !result.trade) {
        throw new Error(result.error ?? 'Trade execution failed');
      }

      // Clear relevant caches after trade execution
      this.tradeLoader.clearUserTrades(userId.toString());
      this.tradeLoader.clearAssetTrades(asset);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Trade execution memory usage:`, {
        userId,
        asset,
        amount,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return result.trade;
    } catch (error) {
      console.error(`Trade execution error for user ${userId}:`, error);
      throw error;
    }
  }

  @Query(() => [Trade])
  async userTrades(
    @Args('userId') userId: string,
    @Args('limit', { defaultValue: 100 }) limit: number,
    @Context() context: { req: any },
  ): Promise<Trade[]> {
    const startTime = process.memoryUsage();

    try {
      // Use DataLoader for batching
      const trades = await this.tradeLoader.userTradesLoader.load(userId);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`User trades memory usage:`, {
        userId,
        tradeCount: trades.length,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return trades.slice(0, limit);
    } catch (error) {
      console.error(`User trades error for user ${userId}:`, error);
      throw error;
    }
  }

  @Query(() => [Trade])
  async assetTrades(
    @Args('asset') asset: string,
    @Args('limit', { defaultValue: 100 }) limit: number,
    @Context() context: { req: any },
  ): Promise<Trade[]> {
    const startTime = process.memoryUsage();

    try {
      // Use DataLoader for batching
      const trades = await this.tradeLoader.assetTradesLoader.load(asset);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Asset trades memory usage:`, {
        asset,
        tradeCount: trades.length,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return trades.slice(0, limit);
    } catch (error) {
      console.error(`Asset trades error for asset ${asset}:`, error);
      throw error;
    }
  }

  @Query(() => Trade, { nullable: true })
  async trade(
    @Args('id') id: number,
    @Context() context: { req: any },
  ): Promise<Trade | null> {
    const startTime = process.memoryUsage();

    try {
      // Use DataLoader for batching
      const trades = await this.tradeLoader.tradeByIdLoader.load(id);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Trade lookup memory usage:`, {
        tradeId: id,
        found: !!trades,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return trades || null;
    } catch (error) {
      console.error(`Trade lookup error for ID ${id}:`, error);
      throw error;
    }
  }
}
