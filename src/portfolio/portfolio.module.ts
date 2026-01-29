import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { TradeEntity } from './entities/trade.entity';
import { Balance } from 'src/balance/balance.entity';
import { Trade } from 'src/trading/entities/trade.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TradeEntity, Balance, Trade]),
    CommonModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
