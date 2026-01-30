import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { MatchingEngineService } from './machine-engine.service';

import { Trade } from './entities/trade.entity';
import { OrderBook } from './entities/order-book.entity';

import { RewardsModule } from '../rewards/rewards.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CacheService } from '../common/services/cache.service';
// import { QueueModule } from 'src/queue/queue.module'; // Temporarily disabled due to compilation issue

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, OrderBook]),
    RewardsModule,
    forwardRef(() => NotificationModule),
    UserModule,
    CustomCacheModule,
  ],
  controllers: [TradingController],
  providers: [TradingService, MatchingEngineService, CacheService],
  exports: [TradingService, MatchingEngineService],
})
export class TradingModule {}
