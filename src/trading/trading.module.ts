import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { BotTradingController } from './bot-trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { UserModule } from '../user/user.module';
import { BotTradingController } from './bot-trading.controller';
import { MatchingEngineModule } from './matching-engine/matching-engine.module';
import { OrderBook } from './entities/order-book.entity';
import { NotificationModule } from '../notification/notification.module';
import { CacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, OrderBook]),
    UserBadgeModule,
    UserModule,
    NotificationModule,
    CacheModule,
    MatchingEngineModule,
  ],
  controllers: [TradingController, BotTradingController],
  providers: [TradingService],
import { Trade } from './entities/trade.entity';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { OrderBook } from './entities/order-book.entity';
import { MatchingEngineService } from './machine-engine.service';
import { NotificationModule } from '../notification/notification.module';
import { CustomCacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, VirtualAsset, OrderBook]),
    UserBadgeModule,
    UserModule,
    NotificationModule,
    CustomCacheModule,
  ],
  controllers: [TradingController, BotTradingController],
  providers: [TradingService, MatchingEngineService],
  exports: [TradingService],
})
export class TradingModule {}
