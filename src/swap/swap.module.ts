import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { SwapHistory } from './entities/swap-history.entity';
import { SwapPricingService } from './swap-pricing.service';
import { SwapSettlementService } from './swap-settlement.service';
import { SwapSagaService } from './swap-saga.service';
import { SwapBatchProcessor } from './swap-batch.processor';
import { QueueName } from '../queue/queue.constants';
import { QueueModule } from '../queue/queue.module';
import { CustomCacheModule } from '../common/cache/cache.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBalance, VirtualAsset, SwapHistory]),
    BullModule.registerQueue({
      name: QueueName.SWAPS,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    }),
    QueueModule,       // provides QueueService
    CustomCacheModule, // provides CacheService
    BalanceModule,
  ],
  controllers: [SwapController],
  providers: [
    SwapService,
    SwapPricingService,
    SwapSettlementService,
    SwapSagaService,
    SwapBatchProcessor,
  ],
  exports: [SwapService, SwapPricingService],
})
export class SwapModule {}
