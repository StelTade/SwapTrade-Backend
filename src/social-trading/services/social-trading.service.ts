import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TraderProfile } from '../entities/trader-profile.entity';
import { CopySubscription } from '../entities/copy-subscription.entity';
import {
  CopyOrderTypeFilter,
  StrategyVisibility,
  SubscriptionStatus,
  UserId,
} from '../enums/social-trading.enum';
import {
  CreateCopySubscriptionDto,
  CreateTraderProfileDto,
  SocialFeedEntryDto,
  TraderProfileResponseDto,
  UpdateCopySubscriptionDto,
  UpdateTraderProfileDto,
} from '../dto/social-trading.dto';
import { Trade } from '../../database/entities/trade.entity';

/**
 * Top-level service for the social-trading API surface. All client
 * interactions go through this service: profile CRUD, subscribe /
 * unsubscribe, social feed read, leaderboard reads are delegated
 * to LeaderboardService.
 *
 * IMPORTANT — this service does NOT itself emit any events. The
 * TradeExecuted → Copy-Trade wiring lives in CopyTradingListener
 * because it must run async of the request lifecycle (the master
 * order is already committed by the time we want to mirror it).
 */
@Injectable()
export class SocialTradingService {
  private readonly logger = new Logger(SocialTradingService.name);

  constructor(
    @InjectRepository(TraderProfile)
    private readonly profileRepo: Repository<TraderProfile>,
    @InjectRepository(CopySubscription)
    private readonly subscriptionRepo: Repository<CopySubscription>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
  ) {}

  // ─── Profile Operations ──────────────────────────────────────────────

  /**
   * Idempotent profile creation. If the user already has a profile
   * we return it instead of throwing — that's a friendlier UX for
   * "I clicked twice" cases, and matches the upsert pattern the
   * user/identity module uses elsewhere on this codebase.
   */
  async createProfile(
    userId: UserId,
    dto: CreateTraderProfileDto,
  ): Promise<TraderProfileResponseDto> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException(
        `Profile already exists for user ${userId} (id=${existing.id}); use PATCH to update`,
      );
    }
    const profile = this.profileRepo.create({
      userId,
      displayName: dto.displayName,
      bio: dto.bio ?? null,
      visibility: dto.visibility,
      performanceFeePct: dto.performanceFeePct,
      isAcceptingCopiers: true,
      totalSubscribers: 0,
      totalCopiedVolume: 0,
      realizedFollowerPnL: 0,
    });
    const saved = await this.profileRepo.save(profile);
    return this.toProfileDto(saved);
  }

  async updateProfile(
    userId: UserId,
    dto: UpdateTraderProfileDto,
  ): Promise<TraderProfileResponseDto> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(`No profile for user ${userId}`);
    }
    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.visibility !== undefined) profile.visibility = dto.visibility;
    if (dto.performanceFeePct !== undefined) {
      profile.performanceFeePct = dto.performanceFeePct;
    }
    if (dto.isAcceptingCopiers !== undefined) {
      profile.isAcceptingCopiers = dto.isAcceptingCopiers;
    }
    const saved = await this.profileRepo.save(profile);
    return this.toProfileDto(saved);
  }

  async getProfile(userId: UserId): Promise<TraderProfileResponseDto | null> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    return profile ? this.toProfileDto(profile) : null;
  }

  async listPublicProfiles(limit = 20): Promise<TraderProfileResponseDto[]> {
    const profiles = await this.profileRepo.find({
      where: {
        visibility: StrategyVisibility.PUBLIC,
        isAcceptingCopiers: true,
      },
      order: { totalSubscribers: 'DESC' },
      take: limit,
    });
    return profiles.map((p) => this.toProfileDto(p));
  }

  // ─── Subscription Operations ─────────────────────────────────────────

  async subscribe(
    followerUserId: UserId,
    dto: CreateCopySubscriptionDto,
  ): Promise<CopySubscription> {
    if (followerUserId === dto.masterUserId) {
      throw new BadRequestException('Cannot subscribe to your own profile');
    }

    const master = await this.profileRepo.findOne({
      where: { userId: dto.masterUserId },
    });
    if (!master) {
      throw new NotFoundException(
        `Master profile not found for user ${dto.masterUserId}`,
      );
    }
    if (!master.isAcceptingCopiers) {
      throw new BadRequestException(
        `Master ${dto.masterUserId} is not accepting copiers`,
      );
    }
    if (master.visibility === StrategyVisibility.PRIVATE) {
      throw new BadRequestException(
        `Master ${dto.masterUserId} has a PRIVATE profile`,
      );
    }

    const existing = await this.subscriptionRepo.findOne({
      where: {
        followerUserId,
        masterUserId: dto.masterUserId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Already subscribed to master ${dto.masterUserId}`,
      );
    }

    const filterString = (dto.orderTypeFilter ?? []).join(',');

    const sub = this.subscriptionRepo.create({
      followerUserId,
      masterUserId: dto.masterUserId,
      status: SubscriptionStatus.ACTIVE,
      copyMultiplier: dto.copyMultiplier ?? 1.0,
      maxDailyLoss: dto.maxDailyLoss ?? 0,
      maxOrderSizePct: dto.maxOrderSizePct ?? 0,
      orderTypeFilter: filterString,
      pendingFees: 0,
      realizedPnL: 0,
      intradayPnLBaseline: 0,
    });
    const saved = await this.subscriptionRepo.save(sub);

    master.totalSubscribers += 1;
    await this.profileRepo.save(master);
    return saved;
  }

  async updateSubscription(
    followerUserId: UserId,
    subscriptionId: string,
    dto: UpdateCopySubscriptionDto,
  ): Promise<CopySubscription> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }
    if (sub.followerUserId !== followerUserId) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }
    if (dto.copyMultiplier !== undefined)
      sub.copyMultiplier = dto.copyMultiplier;
    if (dto.maxDailyLoss !== undefined) sub.maxDailyLoss = dto.maxDailyLoss;
    if (dto.maxOrderSizePct !== undefined) {
      sub.maxOrderSizePct = dto.maxOrderSizePct;
    }
    if (dto.orderTypeFilter !== undefined) {
      sub.orderTypeFilter = dto.orderTypeFilter.join(',');
    }
    if (dto.isActive !== undefined) {
      if (sub.status === SubscriptionStatus.PAUSED_DAILY_LOSS) {
        // Reset intraday baseline so the daily-limit is recomputed from
        // the new day; if the same loss persists, it'll be re-paused.
        sub.intradayPnLBaseline = Number(sub.realizedPnL);
      }
      sub.status = dto.isActive
        ? SubscriptionStatus.ACTIVE
        : SubscriptionStatus.PAUSED;
    }
    return this.subscriptionRepo.save(sub);
  }

  async unsubscribe(
    followerUserId: UserId,
    subscriptionId: string,
  ): Promise<CopySubscription> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!sub || sub.followerUserId !== followerUserId) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }
    sub.status = SubscriptionStatus.UNSUBSCRIBED;
    const saved = await this.subscriptionRepo.save(sub);

    const master = await this.profileRepo.findOne({
      where: { userId: sub.masterUserId },
    });
    if (master && master.totalSubscribers > 0) {
      master.totalSubscribers -= 1;
      await this.profileRepo.save(master);
    }
    return saved;
  }

  async listMySubscriptions(
    followerUserId: UserId,
    activeOnly = true,
  ): Promise<CopySubscription[]> {
    if (activeOnly) {
      // ACTIVE + PAUSED + PAUSED_DAILY_LOSS all count as "my live subs"
      // (PAUSED_DAILY_LOSS is auto-paused; the follower can still see it
      // because the system is about to resume it at midnight UTC).
      return this.subscriptionRepo.find({
        where: [
          { followerUserId, status: SubscriptionStatus.ACTIVE },
          { followerUserId, status: SubscriptionStatus.PAUSED },
          { followerUserId, status: SubscriptionStatus.PAUSED_DAILY_LOSS },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return this.subscriptionRepo.find({
      where: { followerUserId },
      order: { createdAt: 'DESC' },
    });
  }

  async listMasterSubscribers(
    masterUserId: UserId,
  ): Promise<CopySubscription[]> {
    return this.subscriptionRepo.find({
      where: [
        { masterUserId, status: SubscriptionStatus.ACTIVE },
        { masterUserId, status: SubscriptionStatus.PAUSED },
        { masterUserId, status: SubscriptionStatus.PAUSED_DAILY_LOSS },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Social Feed ─────────────────────────────────────────────────────

  /**
   * DEFINITION OF DONE #4: "Social feed shows recent trades from
   * followed traders". Returns the N most recent Trade rows across
   * every master the caller follows (i.e. has an ACTIVE / PAUSE-ed
   * subscription to). Masters with PRIVATE visibility who are being
   * copied by the caller are still included (the caller is allowed
   * to see them); PUBLIC masters are visible to all.
   */
  async getSocialFeed(
    followerUserId: UserId,
    limit = 50,
  ): Promise<SocialFeedEntryDto[]> {
    const subs = await this.subscriptionRepo.find({
      where: [
        { followerUserId, status: SubscriptionStatus.ACTIVE },
        { followerUserId, status: SubscriptionStatus.PAUSED },
        { followerUserId, status: SubscriptionStatus.PAUSED_DAILY_LOSS },
      ],
    });
    if (subs.length === 0) return [];

    const masterIds = subs.map((s) => s.masterUserId);
    const masters = await this.profileRepo
      .createQueryBuilder('p')
      .where('p.userId IN (:...userIds)', { userIds: masterIds })
      .getMany();
    const masterById = new Map(masters.map((m) => [m.userId, m]));

    // Map master userId UUIDs to numeric IDs for cross-referencing
    // with the Trade table.
    const numericIds = masterIds
      .map((id) => Number.parseInt(id, 10))
      .filter((n) => !Number.isNaN(n));
    if (numericIds.length === 0) {
      // Masters with non-numeric userIds can't be cross-referenced
      // with the Trade table. Return an empty feed rather than
      // synthesizing placeholder rows (which previously looked like
      // real trades to clients sorting by timestamp).
      return [];
    }

    const trades = await this.tradeRepo
      .createQueryBuilder('t')
      .where('t.userId IN (:...userIds)', { userIds: numericIds })
      .orderBy('t.timestamp', 'DESC')
      .take(limit * 6) // overshoot — we'll filter to user's masters below
      .getMany();

    const tradesByUserNumeric = new Map<number, Trade[]>();
    for (const t of trades) {
      const arr = tradesByUserNumeric.get(t.userId) ?? [];
      arr.push(t);
      tradesByUserNumeric.set(t.userId, arr);
    }

    const result: SocialFeedEntryDto[] = [];
    for (const id of masterIds) {
      const master = masterById.get(id);
      if (!master) continue;
      const numericId = Number.parseInt(id, 10);
      const masterTrades = Number.isNaN(numericId)
        ? []
        : (tradesByUserNumeric.get(numericId) ?? []);
      for (const t of masterTrades) {
        result.push({
          id: t.id,
          masterUserId: id,
          masterDisplayName: master.displayName,
          masterVisibility: master.visibility,
          asset: t.asset,
          side: t.type,
          amount: Number(t.amount),
          price: Number(t.price),
          totalValue: Number(t.totalValue),
          timestamp: t.timestamp,
        });
        if (result.length >= limit) break;
      }
      if (result.length >= limit) break;
    }
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return result.slice(0, limit);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private toProfileDto(p: TraderProfile): TraderProfileResponseDto {
    return {
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      bio: p.bio,
      visibility: p.visibility,
      performanceFeePct: Number(p.performanceFeePct),
      isAcceptingCopiers: p.isAcceptingCopiers,
      totalSubscribers: p.totalSubscribers,
      totalCopiedVolume: Number(p.totalCopiedVolume),
      realizedFollowerPnL: Number(p.realizedFollowerPnL),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  /** Quietly expose the CopyOrderTypeFilter enum to callers. */
  static readonly OrderTypeFilter = CopyOrderTypeFilter;
}
