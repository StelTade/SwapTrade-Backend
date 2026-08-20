import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderBookService } from './order-book.service';
import { Order } from '../entities/order.entity';
import { Trade } from '../../database/entities/trade.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { OrderSide, OrderStatus, OrderType } from '../../common/enums/order-type.enum';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn((data) => ({ ...data })),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  })),
});

const mockManager = () => ({
  getRepository: jest.fn(() => mockRepo()),
  save: jest.fn(),
  create: jest.fn((entity, data) => data),
});

const mockDataSource = () => ({
  getRepository: jest.fn() as any,
  transaction: jest.fn(),
});

describe('OrderBookService', () => {
  let service: OrderBookService;
  let dataSource: ReturnType<typeof mockDataSource>;
  let eventEmitter: { emit: jest.Mock };

  const assetId = 1;

  const makeLimitOrder = (
    overrides: Partial<Order> = {},
  ): Order =>
    ({
      id: 'order-1',
      userId: 100,
      assetId,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      status: OrderStatus.PENDING,
      amount: 10,
      filledAmount: 0,
      averageFillPrice: null,
      price: 100,
      stopPrice: null,
      trailingDelta: null,
      trailingReferencePrice: null,
      triggeredAt: null,
      filledAt: null,
      cancelledAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      get remainingAmount() {
        return Number(this.amount) - Number(this.filledAmount);
      },
      ...overrides,
    }) as unknown as Order;

  beforeEach(async () => {
    dataSource = mockDataSource();
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderBookService,
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(OrderBookService);
  });

  describe('getOrderBookSnapshot', () => {
    it('should aggregate resting LIMIT orders into bid/ask levels', async () => {
      const resting = [
        makeLimitOrder({ id: 'b1', side: OrderSide.BUY, price: 99, amount: 5, filledAmount: 0 }),
        makeLimitOrder({ id: 'b2', side: OrderSide.BUY, price: 98, amount: 3, filledAmount: 0 }),
        makeLimitOrder({ id: 'b3', side: OrderSide.BUY, price: 99, amount: 2, filledAmount: 0 }),
        makeLimitOrder({ id: 'a1', side: OrderSide.SELL, price: 101, amount: 4, filledAmount: 0 }),
        makeLimitOrder({ id: 'a2', side: OrderSide.SELL, price: 102, amount: 6, filledAmount: 0 }),
      ];

      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue(resting);
      dataSource.getRepository.mockReturnValue(orderRepo);

      const snapshot = await service.getOrderBookSnapshot(assetId);

      // Bids sorted descending by price: 99 (7 total), 98 (3)
      expect(snapshot.bids).toHaveLength(2);
      expect(snapshot.bids[0]).toEqual({ price: 99, amount: 7, count: 2 });
      expect(snapshot.bids[1]).toEqual({ price: 98, amount: 3, count: 1 });

      // Asks sorted ascending by price: 101, 102
      expect(snapshot.asks).toHaveLength(2);
      expect(snapshot.asks[0]).toEqual({ price: 101, amount: 4, count: 1 });
      expect(snapshot.asks[1]).toEqual({ price: 102, amount: 6, count: 1 });
    });

    it('should return empty arrays when no resting orders exist', async () => {
      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue([]);
      dataSource.getRepository.mockReturnValue(orderRepo);

      const snapshot = await service.getOrderBookSnapshot(assetId);

      expect(snapshot.bids).toHaveLength(0);
      expect(snapshot.asks).toHaveLength(0);
    });
  });

  describe('getOrderBookResponse', () => {
    it('should include topOfBook with bestBid, bestAsk, spread, and midPrice', async () => {
      const resting = [
        makeLimitOrder({ id: 'b1', side: OrderSide.BUY, price: 99, amount: 5, filledAmount: 0 }),
        makeLimitOrder({ id: 'a1', side: OrderSide.SELL, price: 101, amount: 4, filledAmount: 0 }),
      ];

      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue(resting);
      dataSource.getRepository.mockReturnValue(orderRepo);

      const assetRepo = mockRepo();
      assetRepo.findOne.mockResolvedValue({ id: 1, symbol: 'BTC' });
      dataSource.getRepository.mockImplementation((entity: any) => {
        if (entity === VirtualAsset) return assetRepo;
        return orderRepo;
      });

      const response = await service.getOrderBookResponse(assetId, 10);

      expect(response.topOfBook.bestBid).toEqual({ price: 99, amount: 5, count: 1 });
      expect(response.topOfBook.bestAsk).toEqual({ price: 101, amount: 4, count: 1 });
      expect(response.topOfBook.spread).toBe(2);
      expect(response.topOfBook.midPrice).toBe(100);
      expect(response.pair).toBe('BTC');
      expect(response.bids).toHaveLength(1);
      expect(response.asks).toHaveLength(1);
      expect(response.sequence).toBeGreaterThan(0);
    });

    it('should limit depth to the requested number of levels', async () => {
      const resting = Array.from({ length: 20 }, (_, i) =>
        makeLimitOrder({
          id: `b${i}`,
          side: OrderSide.BUY,
          price: 100 - i,
          amount: 1,
          filledAmount: 0,
        }),
      );

      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue(resting);
      dataSource.getRepository.mockReturnValue(orderRepo);

      const assetRepo = mockRepo();
      assetRepo.findOne.mockResolvedValue({ id: 1, symbol: 'ETH' });
      dataSource.getRepository.mockImplementation((entity: any) => {
        if (entity === VirtualAsset) return assetRepo;
        return orderRepo;
      });

      const response = await service.getOrderBookResponse(assetId, 5);

      expect(response.bids).toHaveLength(5);
      // Top bid should be the highest price
      expect(response.bids[0].price).toBe(100);
    });

    it('should handle empty book gracefully', async () => {
      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue([]);
      dataSource.getRepository.mockReturnValue(orderRepo);

      const assetRepo = mockRepo();
      assetRepo.findOne.mockResolvedValue({ id: 1, symbol: 'SOL' });
      dataSource.getRepository.mockImplementation((entity: any) => {
        if (entity === VirtualAsset) return assetRepo;
        return orderRepo;
      });

      const response = await service.getOrderBookResponse(assetId);

      expect(response.topOfBook.bestBid).toBeNull();
      expect(response.topOfBook.bestAsk).toBeNull();
      expect(response.topOfBook.spread).toBeNull();
      expect(response.topOfBook.midPrice).toBeNull();
    });
  });

  describe('broadcastOrderBookUpdate', () => {
    it('should emit orderbook.update event with response data', async () => {
      const resting = [
        makeLimitOrder({ id: 'b1', side: OrderSide.BUY, price: 99, amount: 5, filledAmount: 0 }),
        makeLimitOrder({ id: 'a1', side: OrderSide.SELL, price: 101, amount: 4, filledAmount: 0 }),
      ];

      const orderRepo = mockRepo();
      orderRepo.find.mockResolvedValue(resting);

      const assetRepo = mockRepo();
      assetRepo.findOne.mockResolvedValue({ id: 1, symbol: 'BTC' });
      dataSource.getRepository.mockImplementation((entity: any) => {
        if (entity === VirtualAsset) return assetRepo;
        return orderRepo;
      });

      await service.broadcastOrderBookUpdate(assetId);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'orderbook.update',
        expect.objectContaining({
          assetId,
          pair: 'BTC',
          topOfBook: expect.objectContaining({
            bestBid: expect.any(Object),
            bestAsk: expect.any(Object),
          }),
        }),
      );
    });

    it('should not throw if getOrderBookResponse fails', async () => {
      dataSource.getRepository.mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should not throw
      await expect(
        service.broadcastOrderBookUpdate(assetId),
      ).resolves.toBeUndefined();
    });
  });
});
