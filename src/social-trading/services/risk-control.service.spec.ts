import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { RiskControlService } from './risk-control.service';
import {
  CopyOrderTypeFilter,
  SubscriptionStatus,
} from '../enums/social-trading.enum';
import { OrderSide, OrderType } from '../../common/enums/order-type.enum';

const mockSubscriptionRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

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

describe('RiskControlService', () => {
  let service: RiskControlService;
  let subRepo: ReturnType<typeof mockSubscriptionRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskControlService,
        {
          provide: getRepositoryToken(CopySubscription),
          useFactory: mockSubscriptionRepo,
        },
      ],
    }).compile();

    service = module.get<RiskControlService>(RiskControlService);
    subRepo = module.get(getRepositoryToken(CopySubscription));
  });

  describe('resolveCopyAmount', () => {
    const event = {
      masterUserId: 'master-uuid',
      assetId: 1,
      side: OrderSide.BUY,
      amount: 10,
      price: 100,
      totalValue: 1000,
      orderType: OrderType.MARKET,
      filledAt: Date.now(),
    };

    it('returns null for PAUSED subscription', async () => {
      const sub = makeSub({ status: SubscriptionStatus.PAUSED });
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
    });

    it('returns null for UNSUBSCRIBED subscription', async () => {
      const sub = makeSub({ status: SubscriptionStatus.UNSUBSCRIBED });
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
    });

    it('returns null for PAUSED_DAILY_LOSS subscription', async () => {
      const sub = makeSub({ status: SubscriptionStatus.PAUSED_DAILY_LOSS });
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
    });

    it('skips copy when orderType is filtered out', async () => {
      const sub = makeSub({
        orderTypeFilter: CopyOrderTypeFilter.LIMIT,
      });
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
    });

    it('keeps copy when orderType matches filter', async () => {
      const sub = makeSub({
        orderTypeFilter: `${CopyOrderTypeFilter.MARKET},${CopyOrderTypeFilter.LIMIT}`,
      });
      subRepo.save.mockImplementation(async (s) => s);
      const res = await service.resolveCopyAmount(sub, event, 100, 20);
      expect(res).not.toBeNull();
      expect(res?.amount).toBe(10);
    });

    it('skips copy with zero resolved amount', async () => {
      const sub = makeSub({ copyMultiplier: 0 });
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
    });

    it('caps by maxOrderSizePct when available balance is positive', async () => {
      const sub = makeSub({
        copyMultiplier: 5.0, // would request 50
        maxOrderSizePct: 0.5, // 50% of 100 balance = 50 cap
      });
      subRepo.save.mockImplementation(async (s) => s);
      const res = await service.resolveCopyAmount(sub, event, 100, 20);
      expect(res?.amount).toBe(50);
    });

    it('auto-pauses when intradayLoss >= maxDailyLoss', async () => {
      const sub = makeSub({
        maxDailyLoss: 100,
        realizedPnL: -100, // -100 - 0 baseline = -100 loss
        intradayPnLBaseline: 0,
      });
      subRepo.save.mockImplementation(async (s) => s);
      expect(await service.resolveCopyAmount(sub, event, 100, 20)).toBeNull();
      expect(sub.status).toBe(SubscriptionStatus.PAUSED_DAILY_LOSS);
      expect(subRepo.save).toHaveBeenCalled();
    });

    it('does NOT auto-pause if maxDailyLoss is 0 (uncapped)', async () => {
      const sub = makeSub({
        maxDailyLoss: 0,
        realizedPnL: -1000,
        intradayPnLBaseline: 0,
      });
      subRepo.save.mockImplementation(async (s) => s);
      const res = await service.resolveCopyAmount(sub, event, 100, 20);
      expect(res).not.toBeNull();
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('accrues pendingFees and updates realizedPnL when fee is positive', async () => {
      const sub = makeSub();
      subRepo.save.mockImplementation(async (s) => s);
      const res = await service.resolveCopyAmount(sub, event, 100, 20);
      expect(res).not.toBeNull();
      expect(res?.feeAccrued).toBe(true);
      expect(res?.fee).toBe(200); // 1000 * 0.20
      expect(sub.pendingFees).toBe(200);
    });

    it('accrues no fee when performanceFeePct is zero', async () => {
      const sub = makeSub();
      subRepo.save.mockImplementation(async (s) => s);
      const res = await service.resolveCopyAmount(sub, event, 100, 0);
      expect(res?.fee).toBe(0);
      expect(res?.feeAccrued).toBe(false);
    });
  });

  describe('rollbackDailyReset', () => {
    it('un-pauses PAUSED_DAILY_LOSS subscriptions and rebaselines', async () => {
      const subs = [
        makeSub({
          status: SubscriptionStatus.PAUSED_DAILY_LOSS,
          realizedPnL: -250,
          intradayPnLBaseline: 0,
        }),
      ];
      subRepo.find.mockResolvedValue(subs);
      subRepo.save.mockImplementation(async (s) => s);

      const unpaused = await service.rollbackDailyReset();
      expect(unpaused).toBe(1);
      expect(subs[0].status).toBe(SubscriptionStatus.ACTIVE);
      expect(subs[0].intradayPnLBaseline).toBe(-250);
    });

    it('returns 0 when nothing paused', async () => {
      subRepo.find.mockResolvedValue([]);
      expect(await service.rollbackDailyReset()).toBe(0);
    });
  });
});
