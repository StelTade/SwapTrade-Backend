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

import { BalanceModule } from './balance/balance.module';

import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'swaptrade.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
