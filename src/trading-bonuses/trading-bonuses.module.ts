import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingBonus } from './entities/trading-bonus.entity';
import { Trade } from '../trading/entities/trade.entity';
import { TradingBonusesService } from './trading-bonuses.service';
import { TradingBonusesController } from './trading-bonuses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TradingBonus, Trade])],
  providers: [TradingBonusesService],
  controllers: [TradingBonusesController],
  exports: [TradingBonusesService],
})
export class TradingBonusesModule {}
