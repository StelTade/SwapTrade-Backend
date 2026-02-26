import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { UserBalance } from './entities/user-balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBalanceService } from './service/user-balance.service';
import { CurrencyService } from './service/currency.service';
import { BalanceAudit } from './balance-audit.entity';
import { AuditService } from '../common/logging/audit_service';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CacheService } from '../common/services/cache.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBalance, VirtualAsset, BalanceAudit]),
    CustomCacheModule,
    CommonModule,
  ],
  controllers: [BalanceController],
  providers: [UserBalanceService, CurrencyService, AuditService, CacheService],
  exports: [UserBalanceService, CurrencyService],
})
export class BalanceModule {}
