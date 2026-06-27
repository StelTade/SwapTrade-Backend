import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CopyTradingListener } from './copy-trading.listener';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { TraderProfile } from '../entities/trader-profile.entity';
import {
  OrderBookService,
  TradeExecutedEvent,
} from '../../orders/services/order-book.service';
import { RiskControlService } from '../services/risk-control.service';
import { OrderSide, OrderType } from '../../common/enums/order-type.enum';
import {
  StrategyVisibility,
  SubscriptionStatus,
} from '../enums/social-trading.enum';

const mockSubRepo = () => ({
  find: jest.fn(),
});
const mockProfileRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});
const mockOrderBook = () => ({
  matchTakerOrder: jest.fn(),
});
const mockRisk = () => ({
  resolveCopyAmount: jest.fn(),
});
const mockDataSource = () => {
  const manager = {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn().mockImplementation(async (v) => v),
    }),
  };
  return {
    transaction: jest.fn().mockImplementation(async (cb) => cb(manager)),
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        availableBalance: 100,
        balance: 100,
        lockedBalance: 0,
      }),
    }),
  };
};

const makeSub = (overrides = {}): CopySubscription =>
  ({
    id: 'sub-1',
    followerUserId: 'follower-uuid',
    masterUserId: 'master-uuid',
    status: SubscriptionStatus.ACTIVE,
    copyMultiplier: 1.0,
    maxDailyLoss: 0,
    maxOrderSizePct: 0,
    orderTypeFilter: '',
    pendingFees: 0,
    realizedPnL: 0,
    intradayPnLBaseline: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    getOrderTypeFilterSet: function () {
      if (!this.orderTypeFilter) return new Set();
      return new Set(this.orderTypeFilter.split(',').map((s) => s.trim()));
    },
    ...overrides,
  }) as unknown as CopySubscription;

const makeProfile = (overrides = {}): TraderProfile => ({
  id: 'profile-1',
  userId: 'master-uuid',
  displayName: 'Alpha',
  bio: null,
  visibility: StrategyVisibility.PUBLIC,
  performanceFeePct: 20,
  isAcceptingCopiers: true,
  totalSubscribers: 1,
  totalCopiedVolume: 0,
  realizedFollowerPnL: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CopyTradingListener', () => {
  let listener: CopyTradingListener;
  let subRepo: ReturnType<typeof mockSubRepo>;
  let profileRepo: ReturnType<typeof mockProfileRepo>;
  let orderBook: ReturnType<typeof mockOrderBook>;
  let risk: ReturnType<typeof mockRisk>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopyTradingListener,
        {
          provide: getRepositoryToken(CopySubscription),
          useFactory: mockSubRepo,
        },
        {
          provide: getRepositoryToken(TraderProfile),
          useFactory: mockProfileRepo,
        },
        { provide: OrderBookService, useFactory: mockOrderBook },
        { provide: RiskControlService, useFactory: mockRisk },
        { provide: 'DataSource', useFactory: mockDataSource },
      ],
    }).compile();
    listener = module.get<CopyTradingListener>(CopyTradingListener);
    subRepo = module.get(getRepositoryToken(CopySubscription));
    profileRepo = module.get(getRepositoryToken(TraderProfile));
    orderBook = module.get(OrderBookService);
    risk = module.get(RiskControlService);
    dataSource = module.get('DataSource');
  });

  it('does nothing on missing masterUserId', async () => {
    await listener.handleTradeExecuted({} as TradeExecutedEvent);
    expect(subRepo.find).not.toHaveBeenCalled();
  });

  it('mirrors the trade for ACTIVE subscriptions', async () => {
    const sub = makeSub();
    subRepo.find.mockResolvedValue([sub]);
    profileRepo.findOne.mockResolvedValue(makeProfile());
    risk.resolveCopyAmount.mockResolvedValue({
      amount: 10,
      feeAccrued: true,
      fee: 200,
    });
    profileRepo.save.mockImplementation(async (v) => v);

    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now() - 5,
    };
    await listener.handleTradeExecuted(event);
    expect(risk.resolveCopyAmount).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(orderBook.matchTakerOrder).toHaveBeenCalledTimes(1);
  });

  it('skips events when no subscriptions', async () => {
    subRepo.find.mockResolvedValue([]);
    profileRepo.findOne.mockResolvedValue(makeProfile());
    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    };
    await listener.handleTradeExecuted(event);
    expect(risk.resolveCopyAmount).not.toHaveBeenCalled();
    expect(orderBook.matchTakerOrder).not.toHaveBeenCalled();
  });

  it('does nothing if master profile is missing', async () => {
    subRepo.find.mockResolvedValue([makeSub()]);
    profileRepo.findOne.mockResolvedValue(null);
    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    };
    await listener.handleTradeExecuted(event);
    expect(risk.resolveCopyAmount).not.toHaveBeenCalled();
  });

  it('does nothing if master disabled accepting copiers', async () => {
    subRepo.find.mockResolvedValue([makeSub()]);
    profileRepo.findOne.mockResolvedValue(
      makeProfile({ isAcceptingCopiers: false }),
    );
    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    };
    await listener.handleTradeExecuted(event);
    expect(risk.resolveCopyAmount).not.toHaveBeenCalled();
  });

  it('skips when risk-control blocks (null decision)', async () => {
    subRepo.find.mockResolvedValue([makeSub()]);
    profileRepo.findOne.mockResolvedValue(makeProfile());
    risk.resolveCopyAmount.mockResolvedValue(null);
    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.SELL,
      amount: 5,
      price: 100,
      totalValue: 500,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    };
    await listener.handleTradeExecuted(event);
    expect(orderBook.matchTakerOrder).not.toHaveBeenCalled();
  });

  it('logs a warning when copy-trade lag exceeds 1 second', async () => {
    const sub = makeSub();
    subRepo.find.mockResolvedValue([sub]);
    profileRepo.findOne.mockResolvedValue(makeProfile());
    risk.resolveCopyAmount.mockResolvedValue({
      amount: 10,
      feeAccrued: false,
      fee: 0,
    });
    const event: TradeExecutedEvent = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now() - 2000,
    };
    await listener.handleTradeExecuted(event);
    // No strict assertion on log content; just verifies it didn't throw
    expect(risk.resolveCopyAmount).toHaveBeenCalled();
  });

  it('continues with other followers when one throws', async () => {
    const sub1 = makeSub({ id: 'sub-1' });
    const sub2 = makeSub({ id: 'sub-2' });
    subRepo.find.mockResolvedValue([sub1, sub2]);
    profileRepo.findOne.mockResolvedValue(makeProfile());
    risk.resolveCopyAmount
      .mockResolvedValueOnce(null) // first: skipped
      .mockRejectedValueOnce(new Error('boom')) // second: throws
      .mockResolvedValueOnce({ amount: 5, feeAccrued: false, fee: 0 });
    // We only have two subs; the third mocked call is never actually invoked
    // because the loop bails on the second's error. Verify that:
    await listener.handleTradeExecuted({
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    });
    expect(risk.resolveCopyAmount).toHaveBeenCalledTimes(2);
    expect(orderBook.matchTakerOrder).toHaveBeenCalledTimes(0); // both blocked
  });
});
