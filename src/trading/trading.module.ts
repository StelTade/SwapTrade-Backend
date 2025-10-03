import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { Trade } from './entities/trade.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    UserBadgeModule],
  controllers: [TradingController],
  providers: [TradingService],
})
export class TradingModule {}
