import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraderProfile } from './entities/trader-profile.entity';
import { CopySubscription } from './entities/copy-subscription.entity';
import { Trade } from '../database/entities/trade.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { Order } from '../orders/entities/order.entity';
import { SocialTradingService } from './services/social-trading.service';
import { LeaderboardService } from './services/leaderboard.service';
import { RiskControlService } from './services/risk-control.service';
import { CopyTradingListener } from './listeners/copy-trading.listener';
import { RiskResetCron } from './cron/risk-reset.cron';
import { SocialTradingController } from './controllers/social-trading.controller';
import { OrdersModule } from '../orders/orders.module';

/**
 * Module wiring for social trading.
 *
 * Imports:
 * - OrdersModule: OrderBookService is exported there, which we use
 *   to drive follower-side MATCHET orders inside CopyTradingListener.
 *   We need Order + UserBalance + Trade repos too, but OrdersModule
 *   registers those against its own TypeOrmModule.forFeature, so we
 *   re-register them here as well — TypeORM repos are cheap to add,
 *   and not doing so leaves a runtime Provider-not-found error when
 *   CopyTradingListener injects UserBalance.
 *
 * Controllers: SocialTradingController (the REST surface).
 *
 * Providers: services, the listener, and the cron.
 *
 * Exports: SocialTradingService + LeaderboardService, so future
 * modules (e.g. an upcoming analytics module) can read the feeder
 * results without re-implementing.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TraderProfile,
      CopySubscription,
      Trade,
      UserBalance,
      Order,
    ]),
    OrdersModule,
  ],
  controllers: [SocialTradingController],
  providers: [
    SocialTradingService,
    LeaderboardService,
    RiskControlService,
    CopyTradingListener,
    RiskResetCron,
  ],
  exports: [SocialTradingService, LeaderboardService],
})
export class SocialTradingModule {}
