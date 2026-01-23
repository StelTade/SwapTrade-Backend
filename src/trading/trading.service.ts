import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { UserService } from '../user/user.service';
import { Trade } from './entities/trade.entity';
import { TradeType } from '../common/enums/trade-type.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { OrderBook } from './entities/order-book.entity';
import { OrderType } from '../common/enums/order-type.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { MatchingEngineService } from './machine-engine.service';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly userBadgeService: UserBadgeService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(OrderBook)
    private readonly orderBookRepository: Repository<OrderBook>,
    private readonly matchingEngine: MatchingEngineService,
    private readonly cacheService: CacheService,
  ) {}

  async swap(
    userId: number,
    asset: string,
    amount: number,
    price: number,
    type: string,
  ): Promise<{
    success: boolean;
    trade?: Trade;
    badgeAwarded?: boolean;
    error?: string;
  }> {
    // Validate input
    if (!userId || !asset || !amount || !price || !type) {
      return { success: false, error: 'Missing required swap parameters.' };
    }

    let trade: Trade;
    let badgeAwarded = false;
    try {
      // Convert type string to TradeType enum
      const tradeTypeEnum = type === 'BUY' ? TradeType.BUY : TradeType.SELL;
      trade = this.tradeRepository.create({
        userId,
        asset,
        amount,
        price,
        type: tradeTypeEnum,
      });
      await this.tradeRepository.save(trade);

      // Emit order filled notification
      await this.notificationService.sendEvent(
        userId,
        NotificationEventType.ORDER_FILLED,
        `Order ${type} ${amount} ${asset} at ${price} filled`,
      );

      // Calculate trade value
      const tradeValue = amount * price;

     
      const pnl = tradeTypeEnum === TradeType.BUY ? -tradeValue : tradeValue;

      // Update portfolio after successful trade
      // Convert userId to string and use asset as assetId
      await this.userService.updatePortfolioAfterTrade(
        userId.toString(),
        asset, // asset is the assetId
        tradeValue,
        pnl,
      );

      // Update user balance
      const balanceChange = tradeTypeEnum === TradeType.BUY ? amount : -amount;
      await this.userService.updateBalance(
        userId.toString(),
        asset,
        balanceChange,
      );

      // Check if this is the user's first trade (with eager loading)
      const previousTrades = await this.tradeRepository.count({
        where: { userId },
      });
      if (previousTrades === 1) {
        // Only award if this is the first
        const badgeName = 'First Trade';
        const badge = await this.userBadgeService.awardBadge(userId, badgeName);
        badgeAwarded = !!badge;
        if (badgeAwarded) {
          await this.notificationService.sendEvent(
            userId,
            NotificationEventType.ACHIEVEMENT_UNLOCKED,
            `Achievement unlocked: ${badgeName}`,
          );
        }
      }

      // Invalidate cache after trade execution
      await this.cacheService.invalidateTradeRelatedCaches(userId.toString(), asset);

      return { success: true, trade, badgeAwarded };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async placeOrder(
    userId: number,
    asset: string,
    type: OrderType,
    amount: number,
    price: number,
  ): Promise<any> {
    try {
      const order = this.orderBookRepository.create({
        userId,
        asset,
        type,
        amount,
        price,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: amount,
      });

      return await this.orderBookRepository.save(order);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getOrderBook(asset: string): Promise<OrderBook[]> {
    return this.orderBookRepository.find({
      where: { asset, status: OrderStatus.PENDING },
      order: { price: 'ASC' },
    });
  }

  async cancelOrder(orderId: number, userId: number): Promise<any> {
    try {
      const order = await this.orderBookRepository.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.status = OrderStatus.CANCELLED;
      await this.orderBookRepository.save(order);

      return { success: true, order };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeOrder(orderId: number): Promise<any> {
    try {
      const order = await this.orderBookRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      order.status = OrderStatus.FILLED;
      order.filledAmount = order.amount;
      order.remainingAmount = 0;
      order.executedAt = new Date();

      await this.orderBookRepository.save(order);

      return { success: true, order };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute matching cycle for all active orders
   * This would typically be called periodically or on new order submission
   */
  async executeMatchingCycle(
    bids: OrderBook[],
    asks: OrderBook[],
  ): Promise<{
    success: boolean;
    tradesExecuted: number;
    totalVolume: number;
    executionTime: number;
  }> {
    try {
      this.logger.log(
        `Starting matching cycle: ${bids.length} bids, ${asks.length} asks`,
      );

      // Transform OrderBook entities to Order interface expected by matching engine
      const transformedBids = bids.map(order => ({
        id: order.id.toString(),
        userId: order.userId.toString(),
        asset: order.asset,
        amount: order.amount,
        price: order.price,
        remainingAmount: order.remainingAmount,
        timestamp: order.createdAt,
        type: order.type === OrderType.BUY ? 'BID' : 'ASK' as 'BID' | 'ASK',
      }));

      const transformedAsks = asks.map(order => ({
        id: order.id.toString(),
        userId: order.userId.toString(),
        asset: order.asset,
        amount: order.amount,
        price: order.price,
        remainingAmount: order.remainingAmount,
        timestamp: order.createdAt,
        type: order.type === OrderType.BUY ? 'BID' : 'ASK' as 'BID' | 'ASK',
      }));

      const result = await this.matchingEngine.matchTrades(transformedBids, transformedAsks);

      this.logger.log(
        `Matching cycle complete: ${result.tradesExecuted} trades executed, ` +
          `${result.failedMatches} failed, ${result.executionTime}ms`,
      );

      return {
        success: true,
        tradesExecuted: result.tradesExecuted,
        totalVolume: result.totalVolume,
        executionTime: result.executionTime,
      };
    } catch (error) {
      this.logger.error(`Matching cycle failed: ${error.message}`, error.stack);
      return {
        success: false,
        tradesExecuted: 0,
        totalVolume: 0,
        executionTime: 0,
      };
    }
  }

  /**
   * Get user trade history
   */
  async getUserTrades(userId: string, limit = 100) {
    return this.matchingEngine.getTradeHistory(userId, limit);
  }

  /**
   * Get trades for specific asset
   */
  async getAssetTrades(asset: string, limit = 100) {
    return this.matchingEngine.getAssetTrades(asset, limit);
  }
}
