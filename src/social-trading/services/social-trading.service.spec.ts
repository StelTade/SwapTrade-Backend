import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SocialTradingService } from './social-trading.service';
import { TraderProfile } from '../entities/trader-profile.entity';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { Trade } from '../../database/entities/trade.entity';
import {
  CopyOrderTypeFilter,
  StrategyVisibility,
  SubscriptionStatus,
} from '../enums/social-trading.enum';
import { CreateCopySubscriptionDto } from '../dto/social-trading.dto';

const mockProfileRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockSubRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockTradeRepo = () => ({
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const makeProfile = (overrides = {}): TraderProfile => ({
  id: 'profile-1',
  userId: 'master-uuid',
  displayName: 'AlphaTrader',
  bio: null,
  visibility: StrategyVisibility.PUBLIC,
  performanceFeePct: 20,
  isAcceptingCopiers: true,
  totalSubscribers: 0,
  totalCopiedVolume: 0,
  realizedFollowerPnL: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSubscription = (overrides = {}): CopySubscription =>
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

describe('SocialTradingService', () => {
  let service: SocialTradingService;
  let profileRepo: ReturnType<typeof mockProfileRepo>;
  let subRepo: ReturnType<typeof mockSubRepo>;
  let tradeRepo: ReturnType<typeof mockTradeRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialTradingService,
        {
          provide: getRepositoryToken(TraderProfile),
          useFactory: mockProfileRepo,
        },
        {
          provide: getRepositoryToken(CopySubscription),
          useFactory: mockSubRepo,
        },
        { provide: getRepositoryToken(Trade), useFactory: mockTradeRepo },
      ],
    }).compile();
    service = module.get<SocialTradingService>(SocialTradingService);
    profileRepo = module.get(getRepositoryToken(TraderProfile));
    subRepo = module.get(getRepositoryToken(CopySubscription));
    tradeRepo = module.get(getRepositoryToken(Trade));
  });

  // ─── Profiles ───────────────────────────────────────────────────────

  describe('createProfile', () => {
    it('creates a new profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      profileRepo.create.mockImplementation((v) => v);
      profileRepo.save.mockImplementation(async (v) => v);

      const result = await service.createProfile('user-1', {
        displayName: 'TraderJoe',
        visibility: StrategyVisibility.PUBLIC,
        performanceFeePct: 15,
      });
      expect(result.displayName).toBe('TraderJoe');
      expect(result.userId).toBe('user-1');
    });

    it('throws ConflictException if profile already exists', async () => {
      profileRepo.findOne.mockResolvedValue(makeProfile());
      await expect(
        service.createProfile('user-1', {
          displayName: 'x',
          visibility: StrategyVisibility.PUBLIC,
          performanceFeePct: 10,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProfile', () => {
    it('updates an existing profile', async () => {
      const profile = makeProfile();
      profileRepo.findOne.mockResolvedValue(profile);
      profileRepo.save.mockImplementation(async (v) => v);
      const result = await service.updateProfile('master-uuid', {
        bio: 'updated bio',
      });
      expect(result.bio).toBe('updated bio');
    });

    it('throws NotFoundException if profile does not exist', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateProfile('missing', { bio: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('returns null when no profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      expect(await service.getProfile('ghost')).toBeNull();
    });

    it('returns the dto when found', async () => {
      profileRepo.findOne.mockResolvedValue(makeProfile());
      const result = await service.getProfile('master-uuid');
      expect(result?.id).toBe('profile-1');
    });
  });

  // ─── Subscribe / Unsubscribe ────────────────────────────────────────

  describe('subscribe', () => {
    it('throws BadRequestException when subscribing to self', async () => {
      await expect(
        service.subscribe('self', {
          masterUserId: 'self',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when master has no profile', async () => {
      profileRepo.findOne.mockResolvedValue(null);
      await expect(
        service.subscribe('follower', {
          masterUserId: 'noone',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when master is not accepting copiers', async () => {
      profileRepo.findOne.mockResolvedValue(
        makeProfile({ isAcceptingCopiers: false }),
      );
      await expect(
        service.subscribe('follower', {
          masterUserId: 'master-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for PRIVATE master', async () => {
      profileRepo.findOne.mockResolvedValue(
        makeProfile({ visibility: StrategyVisibility.PRIVATE }),
      );
      await expect(
        service.subscribe('follower', {
          masterUserId: 'master-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when already subscribed', async () => {
      profileRepo.findOne.mockResolvedValue(makeProfile());
      subRepo.findOne.mockResolvedValue(makeSubscription());
      await expect(
        service.subscribe('follower-uuid', {
          masterUserId: 'master-uuid',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a subscription on success and bumps subscriber count', async () => {
      const profile = makeProfile({ totalSubscribers: 3 });
      profileRepo.findOne.mockResolvedValue(profile);
      subRepo.findOne.mockResolvedValue(null);
      subRepo.create.mockImplementation((v) => v);
      subRepo.save.mockImplementation(async (v) => v);
      profileRepo.save.mockImplementation(async (v) => v);

      const result = await service.subscribe('follower-uuid', {
        masterUserId: 'master-uuid',
        copyMultiplier: 0.5,
        maxDailyLoss: 500,
        orderTypeFilter: [CopyOrderTypeFilter.MARKET],
      });
      expect(result.copyMultiplier).toBeCloseTo(0.5, 5);
      expect(result.maxDailyLoss).toBe(500);
      expect(result.orderTypeFilter).toBe(CopyOrderTypeFilter.MARKET);
      expect(profile.totalSubscribers).toBe(4);
    });
  });

  describe('unsubscribe', () => {
    it('marks subscription UNSUBSCRIBED and decrements subscriber count', async () => {
      const sub = makeSubscription({ id: 'sub-1' });
      const profile = makeProfile({ totalSubscribers: 5 });
      subRepo.findOne.mockResolvedValue(sub);
      profileRepo.findOne.mockResolvedValue(profile);
      subRepo.save.mockImplementation(async (v) => v);
      profileRepo.save.mockImplementation(async (v) => v);

      const result = await service.unsubscribe('follower-uuid', 'sub-1');
      expect(result.status).toBe(SubscriptionStatus.UNSUBSCRIBED);
      expect(profile.totalSubscribers).toBe(4);
    });

    it('throws NotFoundException when subscription not found', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(service.unsubscribe('ghost', 'sub-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSubscription', () => {
    it('flips status to ACTIVE on isActive=true', async () => {
      const sub = makeSubscription({ status: SubscriptionStatus.PAUSED });
      subRepo.findOne.mockResolvedValue(sub);
      subRepo.save.mockImplementation(async (v) => v);
      const r = await service.updateSubscription('follower-uuid', 'sub-1', {
        isActive: true,
      });
      expect(r.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('flips status to PAUSED on isActive=false', async () => {
      const sub = makeSubscription();
      subRepo.findOne.mockResolvedValue(sub);
      subRepo.save.mockImplementation(async (v) => v);
      const r = await service.updateSubscription('follower-uuid', 'sub-1', {
        isActive: false,
      });
      expect(r.status).toBe(SubscriptionStatus.PAUSED);
    });
  });

  // ─── Social Feed ─────────────────────────────────────────────────────

  describe('getSocialFeed', () => {
    it('returns empty array when there are no subs', async () => {
      subRepo.find.mockResolvedValue([]);
      expect(await service.getSocialFeed('follower-uuid')).toEqual([]);
    });

    it('returns rows from subscriptions with numeric master ids', async () => {
      const subs = [makeSubscription()];
      subRepo.find.mockResolvedValue(subs);
      profileRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([makeProfile()]),
      });
      tradeRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            userId:
              parseInt('master-uuid'.replace(/[^0-9]/g, '') || '0', 10) || 0,
            asset: 'BTC',
            type: 'BUY',
            amount: 0.5,
            price: 100,
            totalValue: 50,
            timestamp: new Date(),
          },
        ]),
      });

      // Make sure the master userId is parseable to a number for this test
      const numId = 1;
      const numericSub = makeSubscription({ masterUserId: String(numId) });
      const numericProfile = makeProfile({ userId: String(numId) });
      subRepo.find.mockResolvedValue([numericSub]);
      profileRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([numericProfile]),
      });

      const feed = await service.getSocialFeed('follower-uuid');
      expect(feed).toHaveLength(1);
      expect(feed[0].asset).toBe('BTC');
    });
  });
});
