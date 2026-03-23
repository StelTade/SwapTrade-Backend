import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TradingModule } from './trading/trading.module';
import { UserModule } from './user/user.module';
import { RewardsModule } from './rewards/rewards.module';
import { NotificationModule } from './notification/notification.module';
import { BiddingModule } from './bidding/bidding.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { MarketDataModule } from './market-data/market-data.module';
import { ExportModule } from './export/export.module';

import { BalanceModule } from './balance/balance.module';
import { SwapModule } from './swap/swap.module';
import { ReferralModule } from './referral/referral.module';

import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorialModule } from './tutorial/tutorial.module';
import { GqlAppModule } from './graphql/graphql.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AlertModule } from './alerts/alert.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'swaptrade.db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    PortfolioModule,
    TradingModule,
    UserModule,
    RewardsModule,
    NotificationModule,
    BiddingModule,
    CommonModule,
    DatabaseModule,
    BalanceModule,
    SwapModule,
    ReferralModule,
    TutorialModule,
    GqlAppModule,
    MarketDataModule,
    ExportModule,
    AuditLogModule,
    AlertModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
