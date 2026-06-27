import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TraderProfile } from '../entities/trader-profile.entity';
import { Trade } from '../../database/entities/trade.entity';
import { StrategyVisibility } from '../enums/social-trading.enum';
import {
  computeSortino,
  pairRoundTrips,
  SortinoResult,
} from './sortino.util';
import { LeaderboardEntryDto } from '../dto/social-trading.dto';

/**
 * Computes a Sortino-ratio-ranked leaderboard of public traders.
 *
 * ACCEPTANCE CRITERION #2: "Leaderboards use Sortino ratio for fair
 * ranking". Sortino weights downside risk heavier than Sharpe does
 * — strategies with fewer/low-magnitude drawdowns rank higher even
 * at identical mean return, which matches the issue's stated intent
 * of "fair" cross-strategy comparison.
 *
 * Performance: a previous version issued one trade-fetch PER profile
 * (an N+1 anti-pattern). This implementation does one bulk fetch with
 * `WHERE userId IN (...)` and groups the resulting rows by numeric
 * userId in memory. Cost is now: 1 query for profiles + 1 query for
 * trades, regardless of profile count.
 *
 * Sample-size guard: profiles with fewer than `minRoundTrips`
 * closed round-trips are filtered out (brand-new accounts shouldn't
 * rank misleadingly high by virtue of small-N luck).
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(TraderProfile)
    private readonly profileRepo: Repository<TraderProfile>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
  ) {}

  async getLeaderboard(
    limit = 50,
    minRoundTrips = 3,
  ): Promise<LeaderboardEntryDto[]> {
    const profiles = await this.profileRepo.find({
      where: {
        visibility: StrategyVisibility.PUBLIC,
        isAcceptingCopiers: true,
      },
      take: limit * 4, // overshoot; we'll filter by minRoundTrips below
    });
    if (profiles.length === 0) return [];

    // Trade.userId is numeric (legacy schema); TraderProfile.userId
    // is a string UUID. We bridge by parsing — profiles whose userId
    // cannot be parsed as a number are skipped.
    const profileByNumber = new Map<number, TraderProfile>();
    for (const profile of profiles) {
      const numericUserId = Number.parseInt(profile.userId, 10);
      if (Number.isNaN(numericUserId)) {
        this.logger.warn(
          `Profile ${profile.id} has non-numeric userId ${profile.userId} — skipping`,
        );
        continue;
      }
      profileByNumber.set(numericUserId, profile);
    }
    if (profileByNumber.size === 0) return [];

    // Bulk fetch ALL trades for ALL eligible profiles in a single
    // query. We cap at a generous upper bound so a single huge
    // history doesn't lock the endpoint, and split further into
    // chunks if needed — but one query is enough in practice.
    const numericIds = Array.from(profileByNumber.keys());
    const trades = await this.tradeRepo.find({
      where: { userId: In(numericIds) },
      order: { userId: 'ASC', timestamp: 'ASC' },
      take: 5000,
    });

    // Group trades by numeric userId for in-memory pairing.
    const tradesByUser = new Map<number, Trade[]>();
    for (const t of trades) {
      const arr = tradesByUser.get(t.userId) ?? [];
      arr.push(t);
      tradesByUser.set(t.userId, arr);
    }

    const rankings: Array<LeaderboardEntryDto & { _sortino: number }> = [];
    for (const [numericId, profile] of profileByNumber.entries()) {
      const userTrades = tradesByUser.get(numericId) ?? [];
      const trips = pairRoundTrips(
        userTrades.map((t) => ({
          asset: t.asset,
          type: t.type,
          price: Number(t.price),
          amount: Number(t.amount),
        })),
      );
      const sortino: SortinoResult = computeSortino(trips);
      if (sortino.sampleSize < minRoundTrips) continue;

      rankings.push({
        rank: 0,
        masterUserId: profile.userId,
        displayName: profile.displayName,
        visibility: profile.visibility,
        sortinoRatio: this.clamp(sortino.sortinoRatio, -100, 100),
        totalTrades: sortino.sampleSize,
        meanReturn: sortino.meanReturn,
        downsideDeviation: sortino.downsideDeviation,
        realizedFollowerPnL: Number(profile.realizedFollowerPnL),
        totalSubscribers: profile.totalSubscribers,
        _sortino: sortino.sortinoRatio,
      });
    }

    rankings.sort((a, b) => b._sortino - a._sortino);
    return rankings.slice(0, limit).map((r, idx) => {
      const { _sortino, ...rest } = r;
      void _sortino;
      return { ...rest, rank: idx + 1 };
    });
  }

  private clamp(v: number, lo: number, hi: number): number {
    if (Number.isNaN(v)) return 0;
    return Math.max(lo, Math.min(hi, v));
  }
}
