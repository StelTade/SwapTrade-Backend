import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
  controllers: [TradingController],
  providers: [TradingService],
})
export class TradingModule {}
