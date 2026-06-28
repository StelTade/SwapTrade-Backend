import { Injectable } from '@nestjs/common';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { PositionSide } from '../enums/position-side.enum';

export interface MarginMetrics {
  notional: number;
  equity: number;
  maintenanceRequirement: number;
  marginRatio: number;
  unrealizedPnl: number;
}

@Injectable()
export class MarginCalculatorService {
  calculateNotional(size: number, price: number): number {
    return size * price;
  }

  calculateUnrealizedPnl(
    side: PositionSide,
    size: number,
    entryPrice: number,
    currentPrice: number,
  ): number {
    if (side === PositionSide.LONG) {
      return (currentPrice - entryPrice) * size;
    }
    return (entryPrice - currentPrice) * size;
  }

  calculateEquity(
    collateral: number,
    unrealizedPnl: number,
    accruedInterest: number,
  ): number {
    return collateral + unrealizedPnl - accruedInterest;
  }

  calculateMaintenanceRequirement(
    notional: number,
    maintenanceMarginRate: number,
  ): number {
    return notional * maintenanceMarginRate;
  }

  calculateMarginRatio(equity: number, maintenanceRequirement: number): number {
    if (maintenanceRequirement <= 0) return Infinity;
    return equity / maintenanceRequirement;
  }

  calculateLiquidationPrice(
    side: PositionSide,
    size: number,
    entryPrice: number,
    collateral: number,
    maintenanceMarginRate: number,
    accruedInterest = 0,
  ): number {
    if (size <= 0) return 0;

    const mmr = maintenanceMarginRate;
    if (side === PositionSide.LONG) {
      const numerator = collateral - entryPrice * size - accruedInterest;
      const denominator = size * (mmr - 1);
      if (denominator === 0) return 0;
      return Math.max(0, numerator / denominator);
    }

    const numerator = collateral + entryPrice * size - accruedInterest;
    const denominator = size * (1 + mmr);
    return Math.max(0, numerator / denominator);
  }

  calculateEffectiveMaxLeverage(config: MarginPairConfig): number {
    const volatility = Number(config.volatilityPct);
    const factor = Number(config.volatilityLeverageFactor);
    const configuredMax = Number(config.maxLeverage);

    if (volatility <= 0 || factor <= 0) {
      return configuredMax;
    }

    const volatilityCap = Math.floor(1 / ((volatility / 100) * factor));
    return Math.min(configuredMax, Math.max(1, volatilityCap));
  }

  calculateRequiredCollateral(notional: number, leverage: number): number {
    return notional / leverage;
  }

  calculateBorrowedAmount(notional: number, collateral: number): number {
    return Math.max(0, notional - collateral);
  }

  calculatePositionSize(notional: number, entryPrice: number): number {
    if (entryPrice <= 0) return 0;
    return notional / entryPrice;
  }

  computeMetrics(
    side: PositionSide,
    size: number,
    entryPrice: number,
    currentPrice: number,
    collateral: number,
    accruedInterest: number,
    maintenanceMarginRate: number,
  ): MarginMetrics {
    const notional = this.calculateNotional(size, currentPrice);
    const unrealizedPnl = this.calculateUnrealizedPnl(
      side,
      size,
      entryPrice,
      currentPrice,
    );
    const equity = this.calculateEquity(
      collateral,
      unrealizedPnl,
      accruedInterest,
    );
    const maintenanceRequirement = this.calculateMaintenanceRequirement(
      notional,
      maintenanceMarginRate,
    );
    const marginRatio = this.calculateMarginRatio(
      equity,
      maintenanceRequirement,
    );

    return {
      notional,
      equity,
      maintenanceRequirement,
      marginRatio,
      unrealizedPnl,
    };
  }

  shouldLiquidate(equity: number, maintenanceRequirement: number): boolean {
    return equity <= maintenanceRequirement;
  }

  shouldMarginCall(
    marginRatio: number,
    marginCallThresholdRatio: number,
  ): boolean {
    return marginRatio <= marginCallThresholdRatio && marginRatio > 1;
  }

  calculateDailyInterest(
    borrowedAmount: number,
    dailyInterestRateBps: number,
  ): number {
    return borrowedAmount * (dailyInterestRateBps / 10_000);
  }
}
