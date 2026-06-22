import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsuranceFund } from './entities/insurance-fund.entity';
import { InsuranceFundTier } from './entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from './entities/insurance-transaction.entity';
import { LiquidationEvent } from './entities/liquidation-event.entity';
import { InsuranceFundService } from './services/insurance-fund.service';
import { FundHealthService } from './services/fund-health.service';
import { LiquidationProtectionService } from './services/liquidation-protection.service';
import { InsuranceFeeContributionService } from './services/insurance-fee-contribution.service';
import { InsuranceFundController } from './insurance-fund.controller';
import { ProtectionListener } from './listeners/protection.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InsuranceFund,
      InsuranceFundTier,
      InsuranceTransaction,
      LiquidationEvent,
    ]),
  ],
  controllers: [InsuranceFundController],
  providers: [
    InsuranceFundService,
    FundHealthService,
    LiquidationProtectionService,
    InsuranceFeeContributionService,
    ProtectionListener,
  ],
  exports: [
    InsuranceFundService,
    FundHealthService,
    LiquidationProtectionService,
    InsuranceFeeContributionService,
  ],
})
export class ProtectionModule {}
