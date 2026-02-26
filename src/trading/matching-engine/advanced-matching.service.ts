import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MatchingEngine } from './core/matching-engine';
import { OrderPriorityService } from './services/order-priority.service';
import { OrderValidatorService } from './services/order-validator.service';
import { MatchingWorkerPoolService } from './services/matching-worker-pool.service';
import { Order, OrderSide, OrderStatus, OrderType, TimeInForce, MatchResult, MatchingStats } from './types/order.types';
import { Trade, TradeStatus } from '../entities/trade.entity';
import { OrderBook as OrderBookEntity } from '../entities/order-book.entity';
import { Balance } from '../../balance/balance.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Advanced matching service that integrates with the trading system
 * Provides high-level API for order submission and management
 */
@Injectable()
export class AdvancedMatchingService implements OnModuleInit {
  private readonly logger = new Logger(AdvancedMatchingService.name);
  private matchingStats: Map<string, MatchingStats> = new Map();

  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    @InjectRepository(OrderBookEntity)
    private readonly orderBookRepository: Repository<OrderBookEntity>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly dataSource: DataSource,
    private readonly matchingEngine: MatchingEngine,
    private readonly priorityService: OrderPriorityService,
    private readonly validatorService: OrderValidatorService,
    private readonly workerPool: MatchingWorkerPoolService,
  ) {}

  async onModuleInit() {
    this.logger.log('Advanced Matching Engine initialized');
    
    // Set up event listeners
    this.matchingEngine.on('match', (match: MatchResult) => this.handleMatch(match));
    this.matchingEngine.on('orderFilled', (order: Order) => this.handleOrderFilled(order));
    this.matchingEngine.on('orderCancelled', (order: Order) => this.handleOrderCancelled(order));
    
    // Load existing orders from database
    await this.loadExistingOrders();
  }

  /**
   * Submit new order
   */
  async submitOrder(
    userId: string,
    asset: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number,
    stopPrice?: number,
    timeInForce: TimeInForce = TimeInForce.GTC,
  ): Promise<{ order: Order; matches: MatchResult[] }> {
    // Create order object
    const order: Order = {
      id: uuidv4(),
      userId,
      asset,
      side,
      type,
      price,
      stopPrice,
      quantity,
      filledQuantity: 0,
      remainingQuantity: quantity,
      timeInForce,
      timestamp: new Date(),
      priority: 0,
      status: OrderStatus.PENDING,
    };

    // Validate order
    const validation = this.validatorService.validate(order);
    if (!validation.valid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    // Check user balance
    const balances = await this.getUserBalances(userId, asset);
    const balanceValidation = this.validatorService.validateBalance(
      order,
      balances.quoteBalance,
      balances.assetBalance,
    );
    
    if (!balanceValidation.valid) {
      throw new Error(`Balance validation failed: ${balanceValidation.errors.join(', ')}`);
    }

    // Check market conditions
    const orderBook = this.matchingEngine.getOrderBook(asset);
    const bestBid = orderBook?.getBestBid() || null;
    const bestAsk = orderBook?.getBestAsk() || null;
    
    const marketValidation = this.validatorService.validateMarketConditions(order, bestBid, bestAsk);
    if (!marketValidation.valid) {
      this.logger.warn(`Market validation warnings: ${marketValidation.errors.join(', ')}`);
    }

    // Calculate priority
    const marketPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : undefined;
    order.priority = this.priorityService.calculatePriority(order, marketPrice);

    // Persist order to database
    await this.persistOrder(order);

    // Submit to matching engine
    const result = await this.matchingEngine.submitOrder(order);

    // Update statistics
    this.updateStats(asset, result);

    return result;
  }

  /**
   * Cancel order
   */
  async cancelOrder(userId: string, orderId: string): Promise<boolean> {
    // Find order in database
    const dbOrder = await this.orderBookRepository.findOne({
      where: { id: parseInt(orderId) },
    });

    if (!dbOrder) {
      throw new Error('Order not found');
    }

    if (dbOrder.userId !== parseInt(userId)) {
      throw new Error('Unauthorized to cancel this order');
    }

    // Cancel in matching engine
    const cancelled = await this.matchingEngine.cancelOrder(dbOrder.asset, orderId);

    if (cancelled) {
      // Update database
      await this.orderBookRepository.update(orderId, {
        status: OrderStatus.CANCELLED as any,
      });

      return true;
    }

    return false;
  }

  /**
   * Get order book depth
   */
  async getOrderBookDepth(asset: string, levels: number = 10): Promise<{
    bids: Array<[number, number]>;
    asks: Array<[number, number]>;
  }> {
    const orderBook = this.matchingEngine.getOrderBook(asset);
    
    if (!orderBook) {
      return { bids: [], asks: [] };
    }

    return orderBook.getDepth(levels);
  }

  /**
   * Get matching statistics
   */
  getMatchingStats(asset: string): MatchingStats | null {
    return this.matchingStats.get(asset) || null;
  }

  /**
   * Get worker pool statistics
   */
  getWorkerPoolStats() {
    return this.workerPool.getStats();
  }

  /**
   * Handle match event
   */
  private async handleMatch(match: MatchResult): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        // Create trade records
        const trade = manager.create(Trade, {
          buyerId: match.buyOrderId,
          sellerId: match.sellOrderId,
          asset: 'UNKNOWN', // Will be set from order
          amount: match.quantity,
          price: match.price,
          totalValue: match.quantity * match.price,
          status: TradeStatus.EXECUTED,
          timestamp: match.timestamp,
          metadata: {
            buyerFee: match.buyerFee,
            sellerFee: match.sellerFee,
          },
        });

        await manager.save(trade);

        // Update balances
        await this.updateBalancesForMatch(manager, match);
      });

      this.logger.log(`Match executed: ${match.quantity} @ ${match.price}`);
    } catch (error) {
      this.logger.error(`Failed to handle match: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle order filled event
   */
  private async handleOrderFilled(order: Order): Promise<void> {
    try {
      await this.orderBookRepository.update(order.id, {
        status: OrderStatus.FILLED as any,
        filledAmount: order.filledQuantity,
        remainingAmount: 0,
        executedAt: new Date(),
      });

      this.logger.log(`Order filled: ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle order filled: ${error.message}`);
    }
  }

  /**
   * Handle order cancelled event
   */
  private async handleOrderCancelled(order: Order): Promise<void> {
    try {
      await this.orderBookRepository.update(order.id, {
        status: OrderStatus.CANCELLED as any,
      });

      this.logger.log(`Order cancelled: ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle order cancelled: ${error.message}`);
    }
  }

  /**
   * Persist order to database
   */
  private async persistOrder(order: Order): Promise<void> {
    const dbOrder = this.orderBookRepository.create({
      userId: parseInt(order.userId),
      asset: order.asset,
      type: order.side === OrderSide.BUY ? 'BUY' : 'SELL',
      status: 'PENDING',
      amount: order.quantity,
      price: order.price || 0,
      filledAmount: 0,
      remainingAmount: order.quantity,
    });

    await this.orderBookRepository.save(dbOrder);
    order.id = dbOrder.id.toString();
  }

  /**
   * Load existing orders from database
   */
  private async loadExistingOrders(): Promise<void> {
    const pendingOrders = await this.orderBookRepository.find({
      where: { status: 'PENDING' },
    });

    this.logger.log(`Loading ${pendingOrders.length} existing orders...`);

    for (const dbOrder of pendingOrders) {
      try {
        const order: Order = {
          id: dbOrder.id.toString(),
          userId: dbOrder.userId.toString(),
          asset: dbOrder.asset,
          side: dbOrder.type === 'BUY' ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.LIMIT,
          price: Number(dbOrder.price),
          quantity: Number(dbOrder.amount),
          filledQuantity: Number(dbOrder.filledAmount),
          remainingQuantity: Number(dbOrder.remainingAmount),
          timeInForce: TimeInForce.GTC,
          timestamp: dbOrder.createdAt,
          priority: 0,
          status: OrderStatus.PENDING,
        };

        await this.matchingEngine.submitOrder(order);
      } catch (error) {
        this.logger.error(`Failed to load order ${dbOrder.id}: ${error.message}`);
      }
    }

    this.logger.log('Existing orders loaded');
  }

  /**
   * Get user balances
   */
  private async getUserBalances(
    userId: string,
    asset: string,
  ): Promise<{ quoteBalance: number; assetBalance: number }> {
    const balances = await this.balanceRepository.find({
      where: { userId: parseInt(userId) },
    });

    const assetBalance = balances.find(b => b.asset === asset);
    const quoteBalance = balances.find(b => b.asset === 'USDT'); // Assuming USDT as quote

    return {
      quoteBalance: quoteBalance ? Number(quoteBalance.amount) : 0,
      assetBalance: assetBalance ? Number(assetBalance.amount) : 0,
    };
  }

  /**
   * Update balances after match
   */
  private async updateBalancesForMatch(manager: any, match: MatchResult): Promise<void> {
    // This would update buyer and seller balances
    // Implementation depends on your balance management system
    this.logger.debug(`Updating balances for match: ${match.buyOrderId} <-> ${match.sellOrderId}`);
  }

  /**
   * Update matching statistics
   */
  private updateStats(asset: string, result: { matches: MatchResult[]; order: Order }): void {
    let stats = this.matchingStats.get(asset);
    
    if (!stats) {
      stats = {
        ordersProcessed: 0,
        matchesExecuted: 0,
        totalVolume: 0,
        averageMatchTime: 0,
        queueDepth: 0,
        rejectedOrders: 0,
      };
      this.matchingStats.set(asset, stats);
    }

    stats.ordersProcessed++;
    stats.matchesExecuted += result.matches.length;
    
    for (const match of result.matches) {
      stats.totalVolume += match.quantity * match.price;
    }

    if (result.order.status === OrderStatus.REJECTED) {
      stats.rejectedOrders++;
    }
  }
}
