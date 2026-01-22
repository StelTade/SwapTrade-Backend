import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { Balance } from './balance.entity';
import { BalanceAudit } from './balance-audit.entity';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
import { AuditService } from '../common/logging/audit_service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Balance, BalanceAudit])
  ],
  controllers: [BalanceController],
  providers: [BalanceService, BalanceHistoryGuard, AuditService],
  exports: [BalanceService],
})
export class BalanceModule {}
