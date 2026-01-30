import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { Balance } from './balance.entity';
import { BalanceAudit } from './balance-audit.entity';
import { UserBalance } from './user-balance.entity';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
import { AuditService } from '../common/logging/audit_service';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CacheService } from '../common/services/cache.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Balance, BalanceAudit, UserBalance]),
    CustomCacheModule,
    CommonModule,
  ],
  controllers: [BalanceController],
  providers: [BalanceService, BalanceHistoryGuard, AuditService, CacheService],
  exports: [BalanceService],
})
export class BalanceModule {}
