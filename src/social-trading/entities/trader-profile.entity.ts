import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StrategyVisibility } from '../enums/social-trading.enum';
import type { UserId } from '../enums/social-trading.enum';

/**
 * A trader's public-facing social-trading profile. Created on demand
 * via SocialTradingService.createProfile() — the first time the user
 * opts in to being copyable. Visible to other users according to
 * `visibility` (PUBLIC/PRIVATE/ANONYMOUS).
 *
 * Mirrors the same populate-on-defeat pattern as Auth/User: only
 * rows that have opted in by creating a profile appear on
 * leaderboards — accounts without a profile are simply not eligible.
 *
 * The numeric counters (totalSubscribers, totalCopiedVolume,
 * realizedPnL) are maintained by the copy-trading listener
 * whenever a follower trade is mirrored, so leaderboards don't
 * have to recompute them on every read.
 */
@Entity('trader_profiles')
@Index(['userId'], { unique: true })
@Index(['visibility', 'isAcceptingCopiers'])
export class TraderProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The owning user (mirrors User.id UUID shape, even though
   * Order/Trade/UserBalance use numeric userIds — see social-trading
   * service for the parseInt bridging).
   */
  @Column()
  @Index()
  userId: UserId;

  @Column({ length: 64 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  /**
   * ACCEPTANCE CRITERION #4: "Traders can choose to make their
   * strategies private or public". PRIVATE profiles don't appear
   * on the public leaderboard; subscribers still see their
   * profile and feed when they log in.
   */
  @Column({
    type: 'varchar',
    default: StrategyVisibility.PUBLIC,
  })
  visibility: StrategyVisibility;

  /**
   * Performance fee, expressed as a percentage (e.g. 20 = 20% of
   * positive follower P&L). ACCEPTANCE CRITERION: "Performance
   * fees are automatically distributed to master traders".
   *
   * NOTE — ORDERS_BUY_LOCKING mirror: this codebase has no
   * settlement-currency ledger, so collected fees are recorded as
   * `pendingFees` on each CopySubscription instead of being moved
   * into a trader's spendable balance. See SocialTradingService
   * CLAIM_FEE_LIMITATION comment for details.
   */
  @Column('decimal', {
    precision: 5,
    scale: 2,
    default: 20,
  })
  performanceFeePct: number;

  /**
   * Risk-control master switch. If false, no new subscribers can
   * start copying AND existing subscriptions are frozen until
   * flipped back on. (Existing in-flight copies that already
   * triggered are not retroactively unwound — same as pausing a
   * validator on Ethereum: in-flight state stays.)
   */
  @Column({ default: true })
  isAcceptingCopiers: boolean;

  /** Cached subscriber count, maintained by the listener. */
  @Column({ default: 0 })
  totalSubscribers: number;

  /** Total notional value of all follower copies, maintained by the listener. */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalCopiedVolume: number;

  /**
   * Sum of realized P&L of follower copies (signed). Maintained by
   * the listener so leaderboards can sort without re-aggregating
   * Trade rows every time.
   */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  realizedFollowerPnL: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
