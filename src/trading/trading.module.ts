import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Trade } from './entities/trade.entity';
import { TradingController } from './controllers/trading.controller';
import { TradingService } from './services/trading.service';
import { MatchingEngine } from './services/matching-engine.service';
import { OrderBook } from './services/order-book.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Trade]), WalletModule],
  controllers: [TradingController],
  providers: [TradingService, MatchingEngine, OrderBook],
  exports: [TradingService],
})
export class TradingModule {}
