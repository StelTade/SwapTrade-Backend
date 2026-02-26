import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { UserBalance } from './user-balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBalanceService } from './service/user-balance.service';
import { CurrencyService } from './service/currency.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBalance, VirtualAsset])],
  controllers: [BalanceController],
  providers: [UserBalanceService, CurrencyService],
  exports: [UserBalanceService, CurrencyService],
})
export class BalanceModule {}
