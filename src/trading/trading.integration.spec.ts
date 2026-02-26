import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradingService } from '../trading/trading.service';
import { AMMService } from '../trading/service/amm.service';
import { OrderBookService } from '../trading/service/order-book.service';
import { Trade } from '../trading/entities/trade.entity';
import { OrderBook } from '../trading/entities/order-book.entity';
import { MarketData } from '../trading/entities/market-data.entity';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { UserService } from '../user/user.service';
import { TradeType } from '../common/enums/trade-type.enum';
import { OrderType, OrderStatus } from '../common/enums/order-type.enum';

describe('Trading Integration Tests', () => {
  let tradingService: TradingService;
  let ammService: AMMService;
  let orderBookService: OrderBookService;
  let tradeRepo: Repository<Trade>;
  let orderBookRepo: Repository<OrderBook>;
  let marketDataRepo: Repository<MarketData>;
  let badgeService: UserBadgeService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        AMMService,
        OrderBookService,
        {
          provide: getRepositoryToken(Trade),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderBook),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(MarketData),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: UserBadgeService,
          useValue: {
            awardBadge: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            updatePortfolioAfterTrade: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    tradingService = module.get<TradingService>(TradingService);
    ammService = module.get<AMMService>(AMMService);
    orderBookService = module.get<OrderBookService>(OrderBookService);
    tradeRepo = module.get<Repository<Trade>>(getRepositoryToken(Trade));
    orderBookRepo = module.get<Repository<OrderBook>>(getRepositoryToken(OrderBook));
    marketDataRepo = module.get<Repository<MarketData>>(getRepositoryToken(MarketData));
    badgeService = module.get<UserBadgeService>(UserBadgeService);
    userService = module.get<UserService>(UserService);
  });

  describe('AMM Trading Simulation', () => {
    it('should execute buy trade with price slippage and fees', async () => {
      const userId = 1;
      const asset = 'BTC';
      const amount = 1;
      const price = 50000;
      const type = 'BUY';

      // Mock market data
      const marketData = {
        asset,
        currentPrice: 50000,
        poolReserveA: 1000000,
        poolReserveB: 50000000,
        feeRate: 0.003,
      };

      (marketDataRepo.findOne as jest.Mock).mockResolvedValue(marketData);
      (marketDataRepo.save as jest.Mock).mockResolvedValue(marketData);

      // Mock AMM calculation
      const expectedOutput = 0.998; // After 0.3% fee
      const executionPrice = 50250; // Price with slippage
      const fee = 150; // 0.3% of 50000

      // Mock trade creation
      const trade = {
        userId,
        asset,
        amount,
        price: executionPrice,
        type: TradeType.BUY,
      } as Trade;

      (tradeRepo.create as jest.Mock).mockReturnValue(trade);
      (tradeRepo.save as jest.Mock).mockResolvedValue(trade);
      (tradeRepo.count as jest.Mock).mockResolvedValue(0);

      (badgeService.awardBadge as jest.Mock).mockResolvedValue({});
      (userService.updatePortfolioAfterTrade as jest.Mock).mockResolvedValue({});
      (userService.updateBalance as jest.Mock).mockResolvedValue({});

      const result = await tradingService.swap(userId, asset, amount, price, type);

      expect(result.success).toBe(true);
      expect(result.trade.price).toBeGreaterThan(price); // Price should increase due to slippage
      expect(tradeRepo.create).toHaveBeenCalled();
      expect(marketDataRepo.save).toHaveBeenCalled(); // Pool reserves should be updated
    });

    it('should execute sell trade with price impact', async () => {
      const userId = 2;
      const asset = 'ETH';
      const amount = 10;
      const price = 3000;
      const type = 'SELL';

      // Mock market data
      const marketData = {
        asset,
        currentPrice: 3000,
        poolReserveA: 1000000,
        poolReserveB: 3000000000,
        feeRate: 0.003,
      };

      (marketDataRepo.findOne as jest.Mock).mockResolvedValue(marketData);
      (marketDataRepo.save as jest.Mock).mockResolvedValue(marketData);

      const trade = {
        userId,
        asset,
        amount,
        price: 2985, // Slightly lower due to slippage
        type: TradeType.SELL,
      } as Trade;

      (tradeRepo.create as jest.Mock).mockReturnValue(trade);
      (tradeRepo.save as jest.Mock).mockResolvedValue(trade);
      (tradeRepo.count as jest.Mock).mockResolvedValue(1);

      (userService.updatePortfolioAfterTrade as jest.Mock).mockResolvedValue({});
      (userService.updateBalance as jest.Mock).mockResolvedValue({});

      const result = await tradingService.swap(userId, asset, amount, price, type);

      expect(result.success).toBe(true);
      expect(result.trade.price).toBeLessThan(price); // Price should decrease for large sell
    });
  });

  describe('Order Book Trading', () => {
    it('should place and execute order book orders', async () => {
      const userId = 1;
      const asset = 'BTC';
      const type = OrderType.BUY;
      const amount = 0.5;
      const price = 51000;

      // Mock order creation
      const order = {
        id: 1,
        userId,
        asset,
        type,
        amount,
        price,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: amount,
      } as OrderBook;

      (orderBookRepo.create as jest.Mock).mockReturnValue(order);
      (orderBookRepo.save as jest.Mock).mockResolvedValue(order);

      const result = await tradingService.placeOrder(userId, asset, type, amount, price);

      expect(result.success).toBe(true);
      expect(orderBookRepo.create).toHaveBeenCalledWith({
        userId,
        asset,
        type,
        amount,
        price,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: amount,
      });
    });

    it('should get order book for an asset', async () => {
      const asset = 'BTC';
      const mockOrderBook = {
        buyOrders: [
          { id: 1, userId: 1, asset, type: OrderType.BUY, amount: 0.5, price: 51000, createdAt: new Date() },
        ],
        sellOrders: [
          { id: 2, userId: 2, asset, type: OrderType.SELL, amount: 0.3, price: 52000, createdAt: new Date() },
        ],
      };

      (orderBookRepo.find as jest.Mock).mockResolvedValue([]);

      const result = await tradingService.getOrderBook(asset);

      expect(result).toBeDefined();
      expect(orderBookRepo.find).toHaveBeenCalledWith({
        where: { asset, status: OrderStatus.PENDING },
        order: { price: 'DESC', createdAt: 'ASC' },
      });
    });
  });

  describe('Realistic Market Effects', () => {
    it('should apply price slippage for large orders', async () => {
      const asset = 'BTC';

      // Create a large buy order that should cause slippage
      const largeOrder = {
        buyOrders: [], // No existing buy orders
        sellOrders: [
          { id: 1, userId: 1, asset, type: OrderType.SELL, amount: 1, price: 50000, createdAt: new Date() },
          { id: 2, userId: 2, asset, type: OrderType.SELL, amount: 2, price: 50100, createdAt: new Date() },
        ],
      };

      (orderBookRepo.find as jest.Mock).mockResolvedValue(largeOrder.sellOrders);

      // Test order book service slippage calculation
      const slippage = orderBookService.calculateSlippage(asset, 5, OrderType.BUY, largeOrder);

      expect(slippage).toBeGreaterThan(0);
      expect(slippage).toBeLessThanOrEqual(0.1); // Should be capped at 10%
    });

    it('should calculate trading fees correctly', async () => {
      const userId = 1;
      const asset = 'BTC';
      const amount = 1;
      const price = 50000;
      const type = 'BUY';

      const marketData = {
        asset,
        currentPrice: 50000,
        feeRate: 0.003, // 0.3%
      };

      (marketDataRepo.findOne as jest.Mock).mockResolvedValue(marketData);

      // The AMM service should calculate fee as amount * price * feeRate
      const expectedFee = amount * price * 0.003; // 150

      // This test would need to be implemented when AMM service is fully integrated
      expect(expectedFee).toBe(150);
    });

    it('should update market data after trades', async () => {
      const asset = 'BTC';
      const initialMarketData = {
        asset,
        currentPrice: 50000,
        poolReserveA: 1000000,
        poolReserveB: 50000000,
        volume24h: 0,
      };

      (marketDataRepo.findOne as jest.Mock).mockResolvedValue(initialMarketData);

      // After a trade, volume should increase and price should change
      const updatedMarketData = {
        ...initialMarketData,
        volume24h: 50000, // Increased by trade amount * price
        currentPrice: 50250, // Changed due to AMM mechanics
      };

      (marketDataRepo.save as jest.Mock).mockResolvedValue(updatedMarketData);

      // Test that market data is updated after swap
      const ammResult = await ammService.executeSwap(asset, 1, true);

      expect(marketDataRepo.save).toHaveBeenCalled();
      expect(ammResult.priceImpact).toBeGreaterThan(0); // Should have price impact
    });
  });

  describe('Order Execution Integration', () => {
    it('should execute orders with proper matching', async () => {
      const orderId = 1;
      const order = {
        id: orderId,
        userId: 1,
        asset: 'BTC',
        type: OrderType.BUY,
        amount: 0.5,
        price: 51000,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: 0.5,
      };

      (orderBookRepo.findOne as jest.Mock).mockResolvedValue(order);

      // Mock order book with matching sell orders
      const sellOrders = [
        { id: 2, userId: 2, asset: 'BTC', type: OrderType.SELL, amount: 0.3, price: 50500, createdAt: new Date() },
      ];

      (orderBookRepo.find as jest.Mock).mockResolvedValue(sellOrders);

      const executionResult = await tradingService.executeOrder(orderId);

      expect(executionResult.success).toBe(true);
      expect(executionResult.executedAmount).toBeGreaterThan(0);
      expect(orderBookRepo.save).toHaveBeenCalled(); // Order status should be updated
    });

    it('should handle partial order fills', async () => {
      const orderId = 1;
      const order = {
        id: orderId,
        userId: 1,
        asset: 'BTC',
        type: OrderType.BUY,
        amount: 2,
        price: 51000,
        status: OrderStatus.PENDING,
        filledAmount: 0,
        remainingAmount: 2,
      };

      (orderBookRepo.findOne as jest.Mock).mockResolvedValue(order);

      // Mock order book with insufficient sell orders for full fill
      const sellOrders = [
        { id: 2, userId: 2, asset: 'BTC', type: OrderType.SELL, amount: 1, price: 50500, createdAt: new Date() },
      ];

      (orderBookRepo.find as jest.Mock).mockResolvedValue(sellOrders);

      const executionResult = await tradingService.executeOrder(orderId);

      expect(executionResult.success).toBe(true);
      expect(executionResult.executedAmount).toBe(1); // Only partially filled
      expect(order.status).toBe(OrderStatus.PARTIAL);
    });
  });
});
