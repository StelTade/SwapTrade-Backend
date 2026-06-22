import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFundService } from './insurance-fund.service';
import { LiquidationEvent } from '../entities/liquidation-event.entity';
import { FundTier } from '../enums/fund-tier.enum';
import { InsuranceTxType } from '../enums/insurance-tx-type.enum';
import {
  InsurancePayoutEvent,
  LiquidationShortfallEvent,
} from '../../infrastructure/events/domain.events';

export interface CoverShortfallResult {
  liquidationEvent: LiquidationEvent;
  coveredAmount: number;
  remainingShortfall: number;
  cascadePrevented: boolean;
  fundsUsed: Array<{ fundId: number; amount: number; tier: string }>;
}

const TIER_PRIORITY: FundTier[] = [
  FundTier.LOW,
  FundTier.MEDIUM,
  FundTier.HIGH,
  FundTier.CRITICAL,
];

@Injectable()
export class LiquidationProtectionService {
  constructor(
    @InjectRepository(LiquidationEvent)
    private readonly liquidationRepo: Repository<LiquidationEvent>,
    private readonly insuranceFundService: InsuranceFundService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async coverShortfall(
    userId: number,
    shortfallAmount: number,
    positionId?: string,
    asset = 'USDT',
    preferredTier?: FundTier,
  ): Promise<CoverShortfallResult> {
    if (shortfallAmount <= 0) {
      throw new Error('Shortfall amount must be positive');
    }

    const tiersToTry = preferredTier
      ? [preferredTier, ...TIER_PRIORITY.filter((t) => t !== preferredTier)]
      : TIER_PRIORITY;

    let remaining = shortfallAmount;
    const fundsUsed: Array<{ fundId: number; amount: number; tier: string }> =
      [];
    let primaryFundId: number | null = null;

    for (const tier of tiersToTry) {
      if (remaining <= 0) break;

      try {
        const fund = await this.insuranceFundService.getFundsByTier(tier, asset);
        const available = Number(fund.balance);
        if (available <= 0) continue;

        const coverAmount = Math.min(available, remaining);
        await this.insuranceFundService.recordTransaction(
          fund.id,
          InsuranceTxType.PAYOUT,
          coverAmount,
          {
            userId,
            referenceId: positionId,
            description: `Liquidation shortfall coverage for user ${userId}`,
            metadata: { positionId, tier, shortfallAmount },
          },
        );

        fundsUsed.push({ fundId: fund.id, amount: coverAmount, tier });
        if (!primaryFundId) primaryFundId = fund.id;
        remaining -= coverAmount;
      } catch {
        continue;
      }
    }

    const coveredAmount = shortfallAmount - remaining;
    const cascadePrevented = remaining <= 0;

    const liquidationEvent = await this.liquidationRepo.save(
      this.liquidationRepo.create({
        userId,
        positionId,
        shortfallAmount,
        coveredAmount,
        fundId: primaryFundId,
        cascadePrevented,
        status: cascadePrevented ? 'COVERED' : 'PARTIAL',
        notes: cascadePrevented
          ? 'Full shortfall covered by insurance fund'
          : `Partial coverage: ${remaining} remaining shortfall`,
      }),
    );

    this.eventEmitter.emit(
      'liquidation.shortfall',
      new LiquidationShortfallEvent(
        liquidationEvent.id,
        userId,
        shortfallAmount,
        coveredAmount,
        cascadePrevented,
      ),
    );

    if (coveredAmount > 0) {
      this.eventEmitter.emit(
        'insurance.payout',
        new InsurancePayoutEvent(
          liquidationEvent.id,
          userId,
          coveredAmount,
          fundsUsed,
        ),
      );
    }

    return {
      liquidationEvent,
      coveredAmount,
      remainingShortfall: remaining,
      cascadePrevented,
      fundsUsed,
    };
  }
}
