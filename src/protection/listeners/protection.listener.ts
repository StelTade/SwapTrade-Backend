import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LiquidationProtectionService } from '../services/liquidation-protection.service';
import { InsuranceFeeContributionService } from '../services/insurance-fee-contribution.service';
import {
  TradeExecutedEvent,
  LiquidationShortfallEvent,
  FundHealthAlertEvent,
} from '../../infrastructure/events/domain.events';

@Injectable()
export class ProtectionListener {
  private readonly logger = new Logger(ProtectionListener.name);

  constructor(
    private readonly liquidationProtection: LiquidationProtectionService,
    private readonly feeContribution: InsuranceFeeContributionService,
  ) {}

  @OnEvent('trade.executed')
  async handleTradeExecuted(event: TradeExecutedEvent): Promise<void> {
    const feeAmount = event.value * 0.001;
    if (feeAmount <= 0) return;

    try {
      await this.feeContribution.contributeFromTradeFee(
        event.tradeId,
        feeAmount,
      );
      this.logger.log(
        `Contributed trading fees from trade ${event.tradeId} to insurance fund`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to contribute fees from trade ${event.tradeId}: ${err}`,
      );
    }
  }

  @OnEvent('liquidation.shortfall')
  handleLiquidationShortfall(event: LiquidationShortfallEvent): void {
    this.logger.log(
      `Liquidation ${event.liquidationId}: covered ${event.coveredAmount}/${event.shortfallAmount}, cascadePrevented=${event.cascadePrevented}`,
    );
  }

  @OnEvent('fund.health.alert')
  handleFundHealthAlert(event: FundHealthAlertEvent): void {
    this.logger.warn(
      `Fund health alert: fund ${event.fundId} (${event.tier}) at ${event.healthPercent.toFixed(2)}% — below 20% threshold`,
    );
  }
}
