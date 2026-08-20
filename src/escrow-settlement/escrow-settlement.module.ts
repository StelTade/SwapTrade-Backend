import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscrowAccount } from './entities/escrow-account.entity';
import { EscrowTransaction } from './entities/escrow-transaction.entity';
import { Settlement } from './entities/settlement.entity';
import { EscrowService } from './services/escrow.service';
import { SettlementService } from './services/settlement.service';
import { EscrowSettlementController } from './escrow-settlement.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserBalance } from '../database/entities/user-balance.entity';

/**
 * EscrowSettlementModule — manages escrow accounts and settlement
 * for peer-to-peer swaps.
 *
 * Provides:
 * - EscrowService: fund locking, release, refund, dispute management
 * - SettlementService: orchestration, partial settlements, dispute hooks
 * - Admin controller: REST endpoints for manual operations with audit trail
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EscrowAccount,
      EscrowTransaction,
      Settlement,
      UserBalance,
    ]),
    AuditLogModule,
  ],
  controllers: [EscrowSettlementController],
  providers: [EscrowService, SettlementService],
  exports: [EscrowService, SettlementService],
})
export class EscrowSettlementModule {}
