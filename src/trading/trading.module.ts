import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';

@Module({
  imports: [UserBadgeModule],
  controllers: [TradingController],
  providers: [TradingService],
})
export class TradingModule {}
