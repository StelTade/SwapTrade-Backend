import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trade } from '../trading/entities/trade.entity';
import { Balance } from '../balance/balance.entity';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { UserBalance } from '../balance/user-balance.entity';
import { CommonModule } from '../common/common.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, Balance, BalanceAudit, UserBalance]),
    CommonModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
