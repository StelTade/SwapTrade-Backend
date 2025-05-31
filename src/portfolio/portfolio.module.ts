import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
