import { Module } from '@nestjs/common';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './bidding.service';
import { BalanceModule } from 'src/balance/balance.module';

@Module({
  imports: [BalanceModule],
  controllers: [BiddingController],
  providers: [BiddingService],
})
export class BiddingModule {}
