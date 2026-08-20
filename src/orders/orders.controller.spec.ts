// Mock the problematic imports that aren't installed in the test env
jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrdersController, OrderBookController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderBookService } from './services/order-book.service';
import { OrderStatus } from '../common/enums/order-type.enum';
import { NotFoundException } from '@nestjs/common';

const mockOrdersService = {
  placeOrder: jest.fn(),
  modifyOrder: jest.fn(),
  cancelOrder: jest.fn(),
  getOrder: jest.fn(),
  getUserOrders: jest.fn(),
  getUserOrdersPaginated: jest.fn(),
};

const mockOrderBookService = {
  getOrderBookSnapshot: jest.fn(),
  getOrderBookResponse: jest.fn(),
  broadcastOrderBookUpdate: jest.fn(),
};

const mockDataSource = {
  getRepository: jest.fn(),
};

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrderBookService, useValue: mockOrderBookService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get(OrdersController);
  });

  describe('DELETE /orders/:id', () => {
    it('should cancel an open order and free reserved funds', async () => {
      const cancelledOrder = {
        id: 'order-123',
        status: OrderStatus.CANCELLED,
        side: 'SELL',
        assetId: 1,
        userId: 42,
      };
      mockOrdersService.cancelOrder.mockResolvedValue(cancelledOrder);

      const result = await controller.deleteOrder('order-123', {
        user: { userId: '42', sub: '42', type: 'access' },
      } as any);

      expect(mockOrdersService.cancelOrder).toHaveBeenCalledWith(42, 'order-123');
      expect(result).toEqual(cancelledOrder);
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should propagate errors from OrdersService', async () => {
      mockOrdersService.cancelOrder.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await expect(
        controller.deleteOrder('nonexistent', {
          user: { userId: '42', sub: '42', type: 'access' },
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /orders (paginated)', () => {
    it('should return paginated orders with metadata', async () => {
      const paginatedResult = {
        data: [
          { id: 'o1', status: OrderStatus.PENDING },
          { id: 'o2', status: OrderStatus.FILLED },
        ],
        total: 25,
        page: 1,
        limit: 20,
        totalPages: 2,
      };
      mockOrdersService.getUserOrdersPaginated.mockResolvedValue(paginatedResult);

      const result = await controller.getUserOrders(
        { page: 1, limit: 20, status: undefined },
        { user: { userId: '42', sub: '42', type: 'access' } } as any,
      );

      expect(mockOrdersService.getUserOrdersPaginated).toHaveBeenCalledWith(
        42, 1, 20, undefined,
      );
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('should pass status filter to service', async () => {
      mockOrdersService.getUserOrdersPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await controller.getUserOrders(
        { page: 1, limit: 20, status: OrderStatus.PENDING },
        { user: { userId: '42', sub: '42', type: 'access' } } as any,
      );

      expect(mockOrdersService.getUserOrdersPaginated).toHaveBeenCalledWith(
        42, 1, 20, OrderStatus.PENDING,
      );
    });
  });
});

describe('OrderBookController', () => {
  let controller: OrderBookController;

  const mockAssetRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderBookController],
      providers: [
        { provide: OrderBookService, useValue: mockOrderBookService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get(OrderBookController);

    mockDataSource.getRepository.mockReturnValue(mockAssetRepo);
  });

  describe('GET /orderbook/:pair', () => {
    it('should resolve numeric asset ID and return order book', async () => {
      const orderBookResponse = {
        assetId: 1,
        pair: 'BTC',
        topOfBook: {
          bestBid: { price: 99, amount: 5, count: 1 },
          bestAsk: { price: 101, amount: 3, count: 1 },
          spread: 2,
          midPrice: 100,
        },
        bids: [{ price: 99, amount: 5, count: 1 }],
        asks: [{ price: 101, amount: 3, count: 1 }],
        timestamp: new Date().toISOString(),
        sequence: 1,
      };
      mockOrderBookService.getOrderBookResponse.mockResolvedValue(orderBookResponse);

      const result = await controller.getOrderBook('1', { depth: 10 });

      expect(mockOrderBookService.getOrderBookResponse).toHaveBeenCalledWith(1, 10);
      expect(result.topOfBook.bestBid!).toEqual(expect.objectContaining({ price: 99 }));
      expect(result.topOfBook.bestAsk!).toEqual(expect.objectContaining({ price: 101 }));
    });

    it('should resolve symbol string to asset ID', async () => {
      mockAssetRepo.findOne.mockResolvedValue({ id: 5, symbol: 'ETH' });
      mockOrderBookService.getOrderBookResponse.mockResolvedValue({
        assetId: 5,
        pair: 'ETH',
        topOfBook: { bestBid: null, bestAsk: null, spread: null, midPrice: null },
        bids: [],
        asks: [],
        timestamp: new Date().toISOString(),
        sequence: 1,
      });

      const result = await controller.getOrderBook('ETH', { depth: 5 });

      expect(mockDataSource.getRepository).toHaveBeenCalled();
      expect(mockAssetRepo.findOne).toHaveBeenCalledWith({
        where: { symbol: 'ETH' },
      });
      expect(mockOrderBookService.getOrderBookResponse).toHaveBeenCalledWith(5, 5);
      expect(result.pair).toBe('ETH');
    });

    it('should throw NotFoundException for unknown asset pair', async () => {
      mockAssetRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.getOrderBook('DOGE', { depth: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default depth of 10 when not specified', async () => {
      mockOrderBookService.getOrderBookResponse.mockResolvedValue({
        assetId: 1,
        pair: 'BTC',
        topOfBook: { bestBid: null, bestAsk: null, spread: null, midPrice: null },
        bids: [],
        asks: [],
        timestamp: new Date().toISOString(),
        sequence: 1,
      });

      await controller.getOrderBook('1', {} as any);

      expect(mockOrderBookService.getOrderBookResponse).toHaveBeenCalledWith(1, 10);
    });
  });
});
