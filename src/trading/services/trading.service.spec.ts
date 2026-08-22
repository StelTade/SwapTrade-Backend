import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TradingService } from './trading.service';
import { MatchingEngine } from './matching-engine.service';
import { WalletLedgerService } from '../../wallet/services/wallet-ledger.service';
import { Order } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderSide, OrderStatus, OrderType } from '../enums/order.enum';
import { BadRequestException } from '@nestjs/common';

describe('TradingService', () => {
  let service: TradingService;
  let matchingEngine: MatchingEngine;
  let walletLedgerService: WalletLedgerService;
  let entityManager: EntityManager;

  beforeEach(async () => {
    const mockOrderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const mockTradeRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const mockMatchingEngine = {
      addOrder: jest.fn().mockReturnValue([]),
    };
    const mockWalletLedgerService = {
      hasSufficientBalance: jest.fn().mockResolvedValue(true),
      reserveBalance: jest.fn().mockResolvedValue(undefined),
      releaseAndTransfer: jest.fn().mockResolvedValue(undefined),
    };
    const mockEntityManager = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockEntityManager)),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Trade), useValue: mockTradeRepo },
        { provide: MatchingEngine, useValue: mockMatchingEngine },
        { provide: WalletLedgerService, useValue: mockWalletLedgerService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    matchingEngine = module.get<MatchingEngine>(MatchingEngine);
    walletLedgerService = module.get<WalletLedgerService>(WalletLedgerService);
    entityManager = module.get<EntityManager>(EntityManager);
  });

  it('should create order when sufficient balance is present', async () => {
    const dto: CreateOrderDto = {
      assetPair: 'BTC/USDT',
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 50000,
      quantity: 1,
    };

    const order = await service.createOrder('user-1', dto);
    expect(order).toBeDefined();
    expect(order.userId).toBe('user-1');
    expect(order.assetPair).toBe('BTC/USDT');
    expect(order.status).toBe(OrderStatus.OPEN);
    expect(walletLedgerService.hasSufficientBalance).toHaveBeenCalledWith('user-1', 'USDT', 50000);
    expect(walletLedgerService.reserveBalance).toHaveBeenCalledWith('user-1', 'USDT', 50000, entityManager);
    expect(matchingEngine.addOrder).toHaveBeenCalled();
  });

  it('should throw BadRequestException when balance is insufficient', async () => {
    jest.spyOn(walletLedgerService, 'hasSufficientBalance').mockResolvedValue(false);

    const dto: CreateOrderDto = {
      assetPair: 'BTC/USDT',
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 50000,
      quantity: 1,
    };

    await expect(service.createOrder('user-1', dto)).rejects.toThrow(BadRequestException);
  });
});
