import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Trade, TradeStatus } from './entities/trade.entity';

interface Order {
  id: string;
  userId: string;
  asset: string;
  amount: number;
  price: number;
  remainingAmount: number;
  timestamp: Date;
  type: 'BID' | 'ASK';
}

interface MatchResult {
  tradesExecuted: number;
  totalVolume: number;
  failedMatches: number;
  executionTime: number;
}

@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Main matching engine - matches bids and asks atomically
   * @param bids - Array of bid orders
   * @param asks - Array of ask orders
   * @returns MatchResult with execution statistics
   */
  async matchTrades(bids: Order[], asks: Order[]): Promise<MatchResult> {
    const startTime = Date.now();
    let tradesExecuted = 0;
    let totalVolume = 0;
    let failedMatches = 0;

    // Sort orders: bids highest to lowest, asks lowest to highest
    // Secondary sort by timestamp for FIFO on same price
    const sortedBids = this.sortBids(bids);
    const sortedAsks = this.sortAsks(asks);

    // Track remaining amounts
    const bidRemaining = new Map(
      sortedBids.map((b) => [b.id, b.remainingAmount]),
    );
    const askRemaining = new Map(
      sortedAsks.map((a) => [a.id, a.remainingAmount]),
    );

    let bidIndex = 0;
    let askIndex = 0;

    // Match orders while possible
    while (bidIndex < sortedBids.length && askIndex < sortedAsks.length) {
      const bid = sortedBids[bidIndex];
      const ask = sortedAsks[askIndex];

      const bidRem = bidRemaining.get(bid.id) || 0;
      const askRem = askRemaining.get(ask.id) || 0;

      // Skip exhausted orders
      if (bidRem <= 0) {
        bidIndex++;
        continue;
      }
      if (askRem <= 0) {
        askIndex++;
        continue;
      }

      // Price check: bid must be >= ask
      if (bid.price < ask.price) {
        break; // No more matches possible
      }

      // Calculate trade amount (minimum of both remaining)
      const tradeAmount = Math.min(bidRem, askRem);

      // Execute trade price is the ask price (market convention)
      const tradePrice = ask.price;

      try {
        // Execute atomic trade
        await this.executeTrade({
          buyerId: bid.userId,
          sellerId: ask.userId,
          asset: bid.asset,
          amount: tradeAmount,
          price: tradePrice,
          bidId: bid.id,
          askId: ask.id,
        });

        // Update remaining amounts
        bidRemaining.set(bid.id, bidRem - tradeAmount);
        askRemaining.set(ask.id, askRem - tradeAmount);

        tradesExecuted++;
        totalVolume += tradeAmount * tradePrice;

        this.logger.debug(
          `Trade executed: ${tradeAmount} ${bid.asset} @ ${tradePrice} ` +
            `(Buyer: ${bid.userId}, Seller: ${ask.userId})`,
        );
      } catch (error) {
        failedMatches++;
        this.logger.error(`Trade failed: ${error.message}`, error.stack);

        // Move to next pair on failure
        bidIndex++;
        askIndex++;
      }
    }

    const executionTime = Date.now() - startTime;

    this.logger.log(
      `Matching complete: ${tradesExecuted} trades, ` +
        `${failedMatches} failed, ${executionTime}ms`,
    );

    return {
      tradesExecuted,
      totalVolume,
      failedMatches,
      executionTime,
    };
  }

  /**
   * Execute a single trade atomically with balance updates
   */
  private async executeTrade(params: {
    buyerId: string;
    sellerId: string;
    asset: string;
    amount: number;
    price: number;
    bidId: string;
    askId: string;
  }): Promise<Trade> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { buyerId, sellerId, asset, amount, price, bidId, askId } = params;
      const totalValue = amount * price;

      // 1. Check buyer has sufficient funds
      const buyerBalance = await this.getBalance(queryRunner, buyerId, 'USD');
      if (buyerBalance < totalValue) {
        throw new Error(
          `Insufficient buyer funds: has ${buyerBalance}, needs ${totalValue}`,
        );
      }

      // 2. Check seller has sufficient asset
      const sellerAssetBalance = await this.getBalance(
        queryRunner,
        sellerId,
        asset,
      );
      if (sellerAssetBalance < amount) {
        throw new Error(
          `Insufficient seller asset: has ${sellerAssetBalance}, needs ${amount}`,
        );
      }

      // 3. Update buyer balances: deduct funds, add asset
      await this.updateBalance(queryRunner, buyerId, 'USD', -totalValue);
      await this.updateBalance(queryRunner, buyerId, asset, amount);

      // 4. Update seller balances: deduct asset, add funds
      await this.updateBalance(queryRunner, sellerId, asset, -amount);
      await this.updateBalance(queryRunner, sellerId, 'USD', totalValue);

      // 5. Create trade record
      const trade = queryRunner.manager.create(Trade, {
        buyerId,
        sellerId,
        asset,
        amount,
        price,
        totalValue,
        status: TradeStatus.EXECUTED,
        bidId,
        askId,
        timestamp: new Date(),
      });

      const savedTrade = await queryRunner.manager.save(Trade, trade);

      // 6. Update order remaining amounts
      await this.updateOrderRemaining(queryRunner, bidId, amount);
      await this.updateOrderRemaining(queryRunner, askId, amount);

      await queryRunner.commitTransaction();
      return savedTrade;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get balance for a user and asset
   */
  private async getBalance(
    queryRunner: QueryRunner,
    userId: string,
    asset: string,
  ): Promise<number> {
    const result = await queryRunner.query(
      `SELECT amount FROM balances WHERE user_id = $1 AND asset = $2 FOR UPDATE`,
      [userId, asset],
    );
    return result[0]?.amount || 0;
  }

  /**
   * Update balance atomically
   */
  private async updateBalance(
    queryRunner: QueryRunner,
    userId: string,
    asset: string,
    delta: number,
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO balances (user_id, asset, amount) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, asset) 
       DO UPDATE SET amount = balances.amount + $3`,
      [userId, asset, delta],
    );
  }

  /**
   * Update order remaining amount
   */
  private async updateOrderRemaining(
    queryRunner: QueryRunner,
    orderId: string,
    amountFilled: number,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE orders 
       SET remaining_amount = remaining_amount - $2,
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, amountFilled],
    );
  }

  /**
   * Sort bids: highest price first, then earliest timestamp (FIFO)
   */
  private sortBids(bids: Order[]): Order[] {
    return [...bids].sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price; // Descending price
      }
      return a.timestamp.getTime() - b.timestamp.getTime(); // Ascending time (FIFO)
    });
  }

  /**
   * Sort asks: lowest price first, then earliest timestamp (FIFO)
   */
  private sortAsks(asks: Order[]): Order[] {
    return [...asks].sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price; // Ascending price
      }
      return a.timestamp.getTime() - b.timestamp.getTime(); // Ascending time (FIFO)
    });
  }

  /**
   * Get trade history for a user
   */
  async getTradeHistory(userId: string, limit = 100): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get trades for specific asset
   */
  async getAssetTrades(asset: string, limit = 100): Promise<Trade[]> {
    return this.tradeRepository.find({
      where: { asset },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
