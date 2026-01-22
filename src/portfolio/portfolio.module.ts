import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { TradeEntity } from './entities/trade.entity';
import { Balance } from 'src/balance/balance.entity';
import { Trade } from 'src/trading/entities/trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity, Balance, Trade])],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
