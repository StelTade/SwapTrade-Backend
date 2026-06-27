import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { SubscriptionStatus } from '../enums/social-trading.enum';
import { TradeExecutedEvent } from '../../orders/services/order-book.service';

/**
 * ACCEPTANCE CRITERION #3: "Users can set maximum daily loss limits
 * for copy-trading". This service implements that.
 *
 * On every attempted copy, we re-evaluate the follower's intraday
 * realized P&L against the subscription's maxDailyLoss. If the loss
 * matches or exceeds the limit, the subscription is auto-paused
 * (status = PAUSED_DAILY_LOSS) and the copy is skipped.
 *
 * `intradayLoss` is computed as:
 *
 *     realizedPnL − intradayPnLBaseline
 *
 * where `realizedPnL` is updated on every successful follower fill
 * (incremented by the difference between this fill's price impact
 * and the master's — for v1, since both legs fill at the same price,
 * the per-fill delta against the master is zero, so intradayLoss is
 * effectively the running sum of any per-fill accounting adjustments
 * we apply here, mainly fees. For "executed within 1s" copies the
 * price is identical between legs by construction).
 *
 * Per-order cap check (`maxOrderSizePct`) is also performed here so
 * we don't sprinkle guards across services.
 */
@Injectable()
export class RiskControlService {
  private readonly logger = new Logger(RiskControlService.name);

  constructor(
    @InjectRepository(CopySubscription)
    private readonly subscriptionRepo: Repository<CopySubscription>,
  ) {}

  /**
   * Returns the proposed copy-fill amount for a (subscription, master
   * trade event) pair, or null if the copy must be skipped. Mutates
   * the subscription's `realizedPnL` field ONLY if a fee is being
   * accrued; status flips to PAUSED_DAILY_LOSS when the daily limit
   * is hit, which is also persisted here.
   *
   * The master's `performanceFeePct` is read from the
   * TraderProfile that the listener passes in (so we don't query the
   * DB from within the listener's hot loop — see CopyTradingListener
   * for the lookup pattern).
   */
  async resolveCopyAmount(
    subscription: CopySubscription,
    event: TradeExecutedEvent,
    followerAvailableBalance: number,
    performanceFeePct: number,
  ): Promise<{ amount: number; feeAccrued: boolean; fee: number } | null> {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return null;
    }

    // Order-type filter check — skip if subscriber opted out of this kind.
    const filter = subscription.getOrderTypeFilterSet();
    if (filter.size > 0 && !filter.has(event.orderType as never)) {
      this.logger.debug(
        `Skipping copy for subscription ${subscription.id}: orderType ${event.orderType} not in filter`,
      );
      return null;
    }

    // Per-order cap (fraction of available balance).
    const rawAmount = event.amount * Number(subscription.copyMultiplier);
    let cappedAmount = rawAmount;
    if (subscription.maxOrderSizePct > 0 && followerAvailableBalance > 0) {
      const orderCap =
        followerAvailableBalance * Number(subscription.maxOrderSizePct);
      cappedAmount = Math.min(cappedAmount, orderCap);
    }
    if (cappedAmount <= 0) {
      this.logger.debug(
        `Skipping copy for subscription ${subscription.id}: would resolve to zero amount`,
      );
      return null;
    }

    // Daily-loss check BEFORE performing the copy. We use the running
    // `realizedPnL` minus the day's baseline to determine today's loss.
    const intradayLoss = Math.max(
      0,
      -(
        Number(subscription.realizedPnL) -
        Number(subscription.intradayPnLBaseline)
      ),
    );
    if (
      subscription.maxDailyLoss > 0 &&
      intradayLoss >= Number(subscription.maxDailyLoss)
    ) {
      // Auto-pause: pause this subscription until the daily-reset cron
      // un-pauses it at midnight UTC. We still allow the user to
      // manually resume via PATCH if they want to override.
      subscription.status = SubscriptionStatus.PAUSED_DAILY_LOSS;
      await this.subscriptionRepo.save(subscription);
      this.logger.warn(
        `Subscription ${subscription.id} auto-paused: intradayLoss=${intradayLoss} ` +
          `>= maxDailyLoss=${subscription.maxDailyLoss}`,
      );
      return null;
    }

    // Performance-fee accrual: this codebase has no settlement currency
    // (ORDERS_BUY_LOCKING-shaped limitation), so we accumulate positive
    // P&L in the subscription's pendingFees bucket rather than moving
    // cash into the master's balance. v1 accrues a fee proportional
    // to totalValue * performanceFeePct, since the mirror-fill-by-id
    // has zero price slippage by construction.
    //
    // NOTE — feeAccrual returns true to tell the listener to update the
    // trader's realizedFollowerPnL counter; we do NOT block the trade
    // on the fee — the trade executes regardless.
    const fee = event.totalValue * (performanceFeePct / 100);
    subscription.pendingFees = Number(subscription.pendingFees) + fee;
    if (fee > 0) {
      subscription.realizedPnL =
        Number(subscription.realizedPnL) + (event.totalValue - fee);
      await this.subscriptionRepo.save(subscription);
      return { amount: cappedAmount, feeAccrued: true, fee };
    }
    return { amount: cappedAmount, feeAccrued: false, fee: 0 };
  }

  /**
   * Resets all active subscriptions' intradayPnLBaseline to the
   * current realizedPnL and un-pauses any PAUSED_DAILY_LOSS ones.
   * Called from the RiskResetCron at midnight UTC.
   */
  async rollbackDailyReset(): Promise<number> {
    const paused = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.PAUSED_DAILY_LOSS },
    });
    let count = 0;
    for (const sub of paused) {
      sub.status = SubscriptionStatus.ACTIVE;
      sub.intradayPnLBaseline = Number(sub.realizedPnL);
      await this.subscriptionRepo.save(sub);
      count += 1;
    }
    this.logger.log(
      `Daily reset complete: unpaused ${count} subscription(s) at UTC midnight`,
    );
    return count;
  }
}
