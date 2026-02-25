import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { Trade } from './entities/trade.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade]),
    UserBadgeModule,
    UserModule,
  ],
  controllers: [TradingController, BotTradingController],
import { BotTradingController } from './bot-trading.controller';
  providers: [TradingService],
})
export class TradingModule {}
