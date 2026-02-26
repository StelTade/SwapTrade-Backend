/**
 * Swap Module
 *
 * The main module for swap features.
 * TODO: Configure imports, controllers, and providers.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VirtualAsset]),
    BalanceModule,
  ],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
