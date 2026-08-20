// Mock the problematic imports that aren't installed in the test env
jest.mock('@nestjs/websockets', () => ({}));
jest.mock('socket.io', () => ({ Server: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid') }));

import { Test, TestingModule } from '@nestjs/testing';
import { OrderBookUpdateListener } from './order-book-update.listener';
import { WebSocketService } from '../../websocket/services/websocket.service';
import type { OrderBookResponse } from '../services/order-book.service';

const mockWebSocketService = {
  broadcastOrderBookUpdate: jest.fn(),
  broadcastOrderUpdate: jest.fn(),
  broadcastTradeExecution: jest.fn(),
};

describe('OrderBookUpdateListener', () => {
  let listener: OrderBookUpdateListener;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderBookUpdateListener,
        { provide: WebSocketService, useValue: mockWebSocketService },
      ],
    }).compile();

    listener = module.get(OrderBookUpdateListener);
  });

  describe('handleOrderBookUpdate', () => {
    it('should broadcast order book update with correct shape', () => {
      const response: OrderBookResponse = {
        assetId: 1,
        pair: 'BTC',
        topOfBook: {
          bestBid: { price: 99, amount: 5, count: 1 },
          bestAsk: { price: 101, amount: 3, count: 1 },
          spread: 2,
          midPrice: 100,
        },
        bids: [
          { price: 99, amount: 5, count: 1 },
          { price: 98, amount: 10, count: 2 },
        ],
        asks: [
          { price: 101, amount: 3, count: 1 },
          { price: 102, amount: 8, count: 3 },
        ],
        timestamp: '2026-08-20T12:00:00.000Z',
        sequence: 42,
      };

      listener.handleOrderBookUpdate(response);

      expect(mockWebSocketService.broadcastOrderBookUpdate).toHaveBeenCalledWith({
        asset: '1',
        bids: [
          { price: 99, amount: 5, count: 1 },
          { price: 98, amount: 10, count: 2 },
        ],
        asks: [
          { price: 101, amount: 3, count: 1 },
          { price: 102, amount: 8, count: 3 },
        ],
        timestamp: '2026-08-20T12:00:00.000Z',
        sequence: 42,
      });
    });

    it('should handle empty order book', () => {
      const response: OrderBookResponse = {
        assetId: 2,
        pair: 'ETH',
        topOfBook: {
          bestBid: null,
          bestAsk: null,
          spread: null,
          midPrice: null,
        },
        bids: [],
        asks: [],
        timestamp: '2026-08-20T12:00:00.000Z',
        sequence: 1,
      };

      listener.handleOrderBookUpdate(response);

      expect(mockWebSocketService.broadcastOrderBookUpdate).toHaveBeenCalledWith({
        asset: '2',
        bids: [],
        asks: [],
        timestamp: '2026-08-20T12:00:00.000Z',
        sequence: 1,
      });
    });
  });
});
