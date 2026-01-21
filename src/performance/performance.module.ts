import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Bid } from '../bidding/entities/bid.entity';
import { OrderBook } from '../trading/entities/order-book.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserBalance,
      Trade,
      Bid,
      OrderBook,
      User,
    ]),
  ],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
