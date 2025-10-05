import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { Trade } from './entities/trade.entity';
import { OrderBook } from './entities/order-book.entity';
import { MarketData } from './entities/market-data.entity';
import { AMMService } from './service/amm.service';
import { OrderBookService } from './service/order-book.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, OrderBook, MarketData]),
    UserBadgeModule],
  controllers: [TradingController],
  providers: [TradingService, AMMService, OrderBookService],
})
export class TradingModule {}
