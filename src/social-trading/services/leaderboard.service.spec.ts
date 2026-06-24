import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaderboardService } from './leaderboard.service';
import { TraderProfile } from '../entities/trader-profile.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StrategyVisibility } from '../enums/social-trading.enum';

const mockProfileRepo = () => ({
  find: jest.fn(),
});
const mockTradeRepo = () => ({
  find: jest.fn(),
});

const makeProfile = (overrides = {}): TraderProfile => ({
  id: 'p',
  userId: '1',
  displayName: 'Trader',
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

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let profileRepo: ReturnType<typeof mockProfileRepo>;
  let tradeRepo: ReturnType<typeof mockTradeRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: getRepositoryToken(TraderProfile),
          useFactory: mockProfileRepo,
        },
        { provide: getRepositoryToken(Trade), useFactory: mockTradeRepo },
      ],
    }).compile();
    service = module.get<LeaderboardService>(LeaderboardService);
    profileRepo = module.get(getRepositoryToken(TraderProfile));
    tradeRepo = module.get(getRepositoryToken(Trade));
  });

  const tradeSeries = (
    numericUserId: number,
    entries: Array<{ side: 'BUY' | 'SELL'; price: number }>,
  ): Trade[] => {
    const out: Trade[] = [];
    for (const e of entries) {
      out.push({
        id: `t-${out.length}`,
        userId: numericUserId,
        asset: 'BTC',
        type: e.side,
        amount: 1,
        price: e.price,
        totalValue: e.price,
        status: 'FILLED',
        timestamp: new Date(Date.now() + out.length * 1000),
        createdAt: new Date(),
      });
    }
    return out;
  };

  it('returns empty array when no profiles', async () => {
    profileRepo.find.mockResolvedValue([]);
    expect(await service.getLeaderboard(10, 3)).toEqual([]);
  });

  it('skips non-numeric userIds without throwing', async () => {
    profileRepo.find.mockResolvedValue([
      makeProfile({ id: 'a', userId: 'not-a-number' }),
    ]);
    expect(await service.getLeaderboard(10, 1)).toEqual([]);
  });

  it('ranks profiles by Sortino ratio descending', async () => {
    profileRepo.find.mockResolvedValue([
      makeProfile({ id: 'a', userId: '1', displayName: 'AlphaA' }),
      makeProfile({ id: 'b', userId: '2', displayName: 'AlphaB' }),
    ]);

    // Profile "1": strong upward trend, no negatives -> sortino = 0
    //   (no downside observed) but high meanReturn.
    // Profile "2": mixed returns with downside -> sortino > 0, smaller
    //   meanReturn but penalty-free of this imperfect metric would
    //   over-rank it. We give both a downside so Sortino is well-
    //   defined for both and distinguishable.
    tradeRepo.find.mockImplementation(async (args: any) => {
      const userId = args.where.userId;
      if (userId === 1) {
        return tradeSeries(1, [
          { side: 'BUY', price: 100 },
          { side: 'SELL', price: 120 },
          { side: 'BUY', price: 120 },
          { side: 'SELL', price: 95 }, // -20.8% downside
        ]);
      }
      if (userId === 2) {
        return tradeSeries(2, [
          { side: 'BUY', price: 100 },
          { side: 'SELL', price: 105 }, // +5%
          { side: 'BUY', price: 105 },
          { side: 'SELL', price: 90 }, // -14.3% downside (smaller magnitude)
        ]);
      }
      return [];
    });

    const result = await service.getLeaderboard(10, 1);
    expect(result).toHaveLength(2);
    // Profile 1 has higher meanReturn than profile 2, so it must rank higher.
    expect(result[0].displayName).toBe('AlphaA');
    expect(result[0].rank).toBe(1);
    expect(result[1].displayName).toBe('AlphaB');
    expect(result[1].rank).toBe(2);
  });

  it('excludes PRIVATE profiles', async () => {
    profileRepo.find.mockResolvedValue([
      makeProfile({
        id: 'pr',
        userId: '1',
        visibility: StrategyVisibility.PRIVATE,
      }),
      makeProfile({
        id: 'an',
        userId: '2',
        visibility: StrategyVisibility.ANONYMOUS,
      }),
    ]);
    expect(await service.getLeaderboard(10, 1)).toEqual([]);
  });

  it('excludes profiles with isAcceptingCopiers=false', async () => {
    profileRepo.find.mockResolvedValue([
      makeProfile({ id: 'a', userId: '1', isAcceptingCopiers: false }),
    ]);
    expect(await service.getLeaderboard(10, 1)).toEqual([]);
  });

  it('respects minRoundTrips filter', async () => {
    profileRepo.find.mockResolvedValue([makeProfile({ id: 'a', userId: '1' })]);
    tradeRepo.find.mockImplementation(async (args: any) => {
      if (args.where.userId === 1) {
        // Only two BUY entries without counterpart → 0 round-trips
        return tradeSeries(1, [
          { side: 'BUY', price: 100 },
          { side: 'BUY', price: 110 },
        ]);
      }
      return [];
    });
    expect(await service.getLeaderboard(10, 3)).toEqual([]);
  });
});
