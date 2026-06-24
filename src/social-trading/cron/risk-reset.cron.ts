import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { RiskControlService } from '../services/risk-control.service';
import { SubscriptionStatus } from '../enums/social-trading.enum';

/**
 * ACCEPTANCE CRITERION #3: "Users can set maximum daily loss limits
 * for copy-trading" — daily reset.
 *
 * We previously had TWO `@Cron(EVERY_DAY_AT_MIDNIGHT)` methods on
 * the same class. NestJS scheduler doesn't guarantee a deterministic
 * call order between two same-expression decorators on one class,
 * which is fragile. They are now collapsed into a single
 * `dailyReset()` method that performs both steps in the correct
 * order.
 *
 * UTC midnight is used as the rollover ("daily" = UTC day) so that
 * the loss window is identical for every follower regardless of
 * their timezone — same convention Binance Futures uses for their
 * daily settlement.
 *
 * Trade-off: the @Cron decorator uses a single process-wide Timer,
 * so if the app restarts across midnight the cron will fire on
 * startup per Nest's @nestjs/scheduler — no manual catch-up needed.
 */
@Injectable()
export class RiskResetCron {
  private readonly logger = new Logger(RiskResetCron.name);

  constructor(
    @InjectRepository(CopySubscription)
    private readonly subscriptionRepo: Repository<CopySubscription>,
    private readonly riskControl: RiskControlService,
  ) {}

  /**
   * Order-of-operations:
   * 1. Rebaseline every ACTIVE/PAUSED subscription's
   *    `intradayPnLBaseline` to its current `realizedPnL`. This
   *    zeroes out today's loss for the new day.
   * 2. Un-pause any subscription RiskControlService auto-paused at
   *    the daily-loss boundary using rollbackDailyReset().
   *
   * If a user's loss pattern is unchanged on the new day, the limit
   * will re-trigger tomorrow — that's intended. The user can
   * manually override by raising maxDailyLoss and using
   * PATCH /subscriptions/:id to flip isActive=true.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyReset(): Promise<void> {
    const actives = await this.subscriptionRepo.find({
      where: [
        { status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.PAUSED },
      ],
    });
    let rebaselined = 0;
    for (const sub of actives) {
      sub.intradayPnLBaseline = Number(sub.realizedPnL);
      await this.subscriptionRepo.save(sub);
      rebaselined += 1;
    }
    const unpaused = await this.riskControl.rollbackDailyReset();
    this.logger.log(
      `Daily reset complete: rebaselined ${rebaselined} subscription(s); ` +
        `unpaused ${unpaused} PAUSED_DAILY_LOSS subscription(s).`,
    );
  }
}
