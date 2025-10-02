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
import { Balance } from '../balance/balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Balance, VirtualAsset])],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
