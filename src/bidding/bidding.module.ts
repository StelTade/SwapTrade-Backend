import { Module } from '@nestjs/common';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './bidding.service';
import { BalanceModule } from 'src/balance/balance.module';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CacheService } from '../common/services/cache.service';

@Module({
  imports: [BalanceModule, CustomCacheModule],
  controllers: [BiddingController],
  providers: [BiddingService, CacheService],
})
export class BiddingModule {}
