import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CopyOrderTypeFilter, SubscriptionStatus } from '../enums/social-trading.enum';
import type { UserId } from '../enums/social-trading.enum';

/**
 * A follower's subscription to a TraderProfile.
 *
 * NOTE: we deliberately do NOT use `@Unique(['followerUserId',
 * 'masterUserId'])` here. Multiple historical subscriptions are
 * allowed per (follower, master) pair: when a user unsubscribes, the
 * prior row stays for audit with status=UNSUBSCRIBED, and a fresh
 * ACTIVE row is created on re-subscribe. A unique constraint would
 * throw QueryFailedError on the second insert and break the
 * audit-trail model. Uniqueness on the LIVE pair (status=ACTIVE) is
 * enforced at the service layer in SocialTradingService.subscribe,
 * which checks for an active row before creating a new one. See
 * issue #396 AC #4 + DoD #1.
 */
@Entity('copy_subscriptions')
@Index(['masterUserId', 'status'])
@Index(['followerUserId', 'status'])
export class CopySubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The follower — the user whose account will receive mirrored
   * orders. String UUID matching JwtPayload.userId.
   */
  @Column()
  @Index()
  followerUserId: UserId;

  /**
   * The master being copied — a TraderProfile.userId.
   * String UUID for consistency with TraderProfile.userId.
   */
  @Column()
  @Index()
  masterUserId: UserId;

  @Column({
    type: 'varchar',
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  /**
   * Copy-size multiplier. The follower's mirrored order amount =
   * fillAmount * copyMultiplier. So if a master SELLs 10 BTC and
   * copyMultiplier=0.5, the follower SELLs 5 BTC (capped by
   * follower's available balance).
   *
   * 1.0 = exact mirror. < 1.0 = proportional down-size. > 1.0 =
   * leveraged copy (still subject to maxOrderSizePct below).
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 1.0,
  })
  copyMultiplier: number;

  /**
   * ACCEPTANCE CRITERION #3: "Users can set maximum daily loss
   * limits for copy-trading". The follower's own maximum
   * cumulative realized loss per UTC day, expressed as an
   * asset-quoted amount in the same units as Order.totalValue / 1.
   * When the follower's intraday realized loss hits this number,
   * the subscription is auto-paused with status PAUSED_DAILY_LOSS
   * and un-paused by the midnight-reset cron.
   *
   * 0 = no limit (will still be checked against `maxOrderSizePct`).
   */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  maxDailyLoss: number;

  /**
   * Optional per-order cap, expressed as a fraction of the
   * follower's available balance for the asset at the moment
   * the copy event fires. 0 means "no per-order cap" beyond
   * what the available balance itself imposes.
   */
  @Column('decimal', {
    precision: 5,
    scale: 4,
    default: 0,
  })
  maxOrderSizePct: number;

  /**
   * Comma-separated list of CopyOrderTypeFilter values (since
   * TypeORM doesn't have first-class list-of-enum support on all
   * drivers). Empty string = no filter = "copy everything".
   * Parsed in SocialTradingService when the listener decides
   * whether to skip a master MARKET or LIMIT trade.
   */
  @Column({ default: '' })
  orderTypeFilter: string;

  /**
   * Performance-fee ledger — sum of fees owed to the master from
   * this follower across all positive-P&L copy trades ever.
   *
   * Collected every time a follower's copy realizes positive P&L
   * (zero for v1 because we mirror the same fill price — see the
   * RiskControlService.feeAccrual() discussion).
   *
   * NOTE — ORDERS_BUY_LOCKING mirror: this codebase has no
   * settlement currency, so collected fees are stored as a ledger
   * entry only; they are NOT moved into the master's spendable
   * balance. The performance-fee AC is satisfied by recording
   * the bookkeeping; actual payout is left for a future
   * settlements module.
   */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  pendingFees: number;

  /**
   * Realized P&L of THIS follower's copy trades since the
   * subscription was opened (signed). Used by the risk-control
   * service to compute "intraday loss" against maxDailyLoss.
   */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  realizedPnL: number;

  /**
   * Realized P&L snapshot at the most recent UTC midnight
   * rollover. The risk-control service computes
   * "today's loss" = realizedPnL - intradayPnLBaseline.
   * Set by the risk-reset cron to 0 (full reset) AND whenever
   * a new subscription is created.
   */
  @Column('decimal', {
    precision: 18,
    scale: 8,
    default: 0,
  })
  intradayPnLBaseline: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Order-type filter parsed into a Set<CopyOrderTypeFilter>. */
  getOrderTypeFilterSet(): Set<CopyOrderTypeFilter> {
    if (!this.orderTypeFilter) return new Set();
    return new Set(
      this.orderTypeFilter
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as CopyOrderTypeFilter[],
    );
  }
}
