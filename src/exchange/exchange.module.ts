import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiquidityPool } from './entities/liquidity-pool.entity';
import { PoolPosition } from './entities/pool-position.entity';
import { PoolSwap } from './entities/pool-swap.entity';
import { EmergencyWithdrawal } from './entities/emergency-withdrawal.entity';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';
import { AmmService } from './services/amm.service';
import { LiquidityPoolService } from './services/liquidity-pool.service';
import { PoolAnalyticsService } from './services/pool-analytics.service';
import {
  LiquidityPoolController,
  PoolPositionController,
} from './liquidity-pool.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LiquidityPool,
      PoolPosition,
      PoolSwap,
      EmergencyWithdrawal,
      VirtualAsset,
    ]),
  ],
  controllers: [LiquidityPoolController, PoolPositionController],
  providers: [AmmService, LiquidityPoolService, PoolAnalyticsService],
  exports: [AmmService, LiquidityPoolService, PoolAnalyticsService],
})
export class ExchangeModule {}
