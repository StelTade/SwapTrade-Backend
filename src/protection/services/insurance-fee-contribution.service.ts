import { Injectable } from '@nestjs/common';
import { InsuranceFundService } from './insurance-fund.service';
import { FundTier } from '../enums/fund-tier.enum';

@Injectable()
export class InsuranceFeeContributionService {
  constructor(private readonly insuranceFundService: InsuranceFundService) {}

  async contributeFromTradeFee(
    tradeId: string,
    feeAmount: number,
    asset = 'USDT',
    tier: FundTier = FundTier.MEDIUM,
  ) {
    const fund = await this.insuranceFundService.getFundsByTier(tier, asset);
    const tierConfig = fund.tier;
    const contributionPct = tierConfig?.feeContributionPct ?? 10;
    const contribution = (feeAmount * contributionPct) / 100;

    if (contribution <= 0) {
      return { contributed: 0, fund };
    }

    const result = await this.insuranceFundService.contributeFromFees(
      fund.id,
      contribution,
      tradeId,
    );

    return { contributed: contribution, ...result };
  }
}
