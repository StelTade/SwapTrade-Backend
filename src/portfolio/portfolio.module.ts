import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { TradeEntity } from './entities/trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity])],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
