import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CopyOrderTypeFilter,
  StrategyVisibility,
} from '../enums/social-trading.enum';

/**
 * Body for POST /social-trading/profiles — creates a new TraderProfile
 * for the authenticated user. Idempotent: a profile is unique on
 * userId, so a second call returns the existing profile (the service
 * does the upsert rather than throwing).
 */
export class CreateTraderProfileDto {
  @IsString()
  @Length(2, 64)
  displayName: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @IsEnum(StrategyVisibility)
  visibility: StrategyVisibility;

  /**
   * Performance fee in percent (e.g. 20 = 20% of positive follower P&L).
   * 0..100 inclusive.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  performanceFeePct: number;
}

/**
 * Body for PATCH /social-trading/profiles/me — partial update of an
 * existing profile. None of the fields are required; only the ones
 * present are written.
 */
export class UpdateTraderProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @IsOptional()
  @IsEnum(StrategyVisibility)
  visibility?: StrategyVisibility;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  performanceFeePct?: number;

  @IsOptional()
  @IsBoolean()
  isAcceptingCopiers?: boolean;
}

/**
 * Body for POST /social-trading/subscriptions — a follower
 * subscribes to a master. masterUserId is in the body rather than
 * the path so a single endpoint can accept any master.
 */
export class CreateCopySubscriptionDto {
  @IsString()
  masterUserId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  copyMultiplier?: number;

  /**
   * ACCEPTANCE CRITERION #3: max daily loss. 0 = uncapped.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDailyLoss?: number;

  /**
   * Per-order cap as a fraction of available balance (0..1).
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  maxOrderSizePct?: number;

  @IsOptional()
  @IsEnum(CopyOrderTypeFilter, { each: true })
  orderTypeFilter?: CopyOrderTypeFilter[];
}

/**
 * Body for PATCH /social-trading/subscriptions/:subscriptionId —
 * partial update of an existing subscription (status flips the
 * pause/resume behavior).
 */
export class UpdateCopySubscriptionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  copyMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxDailyLoss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  maxOrderSizePct?: number;

  @IsOptional()
  @IsEnum(CopyOrderTypeFilter, { each: true })
  orderTypeFilter?: CopyOrderTypeFilter[];

  /**
   * Convenience flag — when present, sets subscription.status to
   * ACTIVE (true) or PAUSED (false). Removes the need for a
   * separate /pause and /resume endpoint pair.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Response shape — projection of TraderProfile for non-owners. We
 * strip smaller fields (just the leaderboard-relevant ones) when
 * the master is private.
 */
export class TraderProfileResponseDto {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  visibility: StrategyVisibility;
  performanceFeePct: number;
  isAcceptingCopiers: boolean;
  totalSubscribers: number;
  totalCopiedVolume: number;
  realizedFollowerPnL: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Single row of /leaderboard results. Sorts by sortinoRatio DESC.
 */
export class LeaderboardEntryDto {
  rank: number;
  masterUserId: string;
  displayName: string;
  visibility: StrategyVisibility;

  /** ACCEPTANCE CRITERION #2: leaderboards use Sortino ratio. */
  sortinoRatio: number;

  totalTrades: number;
  meanReturn: number;
  downsideDeviation: number;
  realizedFollowerPnL: number;
  totalSubscribers: number;
}

/**
 * Single row of /social-feed — a recent master trade from someone
 * the caller follows.
 */
export class SocialFeedEntryDto {
  id: string; // Trade.id
  masterUserId: string;
  masterDisplayName: string;
  masterVisibility: StrategyVisibility;
  asset: string;
  side: string;
  amount: number;
  price: number;
  totalValue: number;
  timestamp: Date;
}
