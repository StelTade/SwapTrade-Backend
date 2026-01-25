import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { MatchingEngineService } from './machine-engine.service';

import { Trade } from './entities/trade.entity';
import { OrderBook } from './entities/order-book.entity';

import { RewardsModule } from '../rewards/rewards.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
// import { QueueModule } from 'src/queue/queue.module'; // Temporarily disabled due to compilation issue

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
