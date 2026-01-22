import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { RewardsModule } from '../rewards/rewards.module';
import { Trade } from './entities/trade.entity';
import { OrderBook } from './entities/order-book.entity';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { MatchingEngineService } from './machine-engine.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, OrderBook]),
    RewardsModule,
    NotificationModule,
    UserModule,
  ],
  controllers: [TradingController],
  providers: [TradingService, MatchingEngineService],
  exports: [TradingService, MatchingEngineService],
})
export class TradingModule {}
