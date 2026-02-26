import { Injectable } from '@nestjs/common';
import { AssetAllocation } from '../dto/portfolio-summary.dto';
import { StressTestResultDto } from '../dto/portfolio-risk.dto';

export interface StressTestScenario {
  name: string;
  description: string;
  assetShocks: Record<string, number>; // symbol -> % change (e.g., -0.5 for -50%)
  marketShock: number; // fallback % change for assets not specified
}

@Injectable()
export class RiskAnalyticsService {
  // Annualized Volatility Estimates (%)
  // In a production system, these would be calculated from historical price data
  private readonly ASSET_VOLATILITY: Record<string, number> = {
    BTC: 80,
    ETH: 90,
    USDT: 1, // Stablecoins have very low volatility
    USDC: 1,
    BNB: 75,
    SOL: 95,
    XRP: 85,
    ADA: 88,
    DOGE: 120,
    DOT: 90,
  };

  private readonly Z_SCORES = {
    95: 1.645,
    99: 2.326,
  };

  /**
   * Calculate Portfolio Volatility (Weighted Average)
   */
  calculatePortfolioVolatility(assets: AssetAllocation[]): number {
    let weightedVol = 0;
    let totalWeight = 0;

    for (const asset of assets) {
      const weight = asset.allocationPercentage / 100;
      const vol = this.ASSET_VOLATILITY[asset.symbol] || 60; // Default 60% if unknown
      weightedVol += weight * vol;
      totalWeight += weight;
    }

    // Normalize if weights don't sum to 1 (though they should)
    return totalWeight > 0 ? weightedVol / totalWeight : 0;
  }

  /**
   * Calculate Parametric Value at Risk (VaR)
   * VaR = Portfolio Value * Volatility * Z-Score * sqrt(t)
   */
  calculateParametricVaR(
    portfolioValue: number,
    annualVolatility: number,
    confidenceLevel: 95 | 99 = 95,
    days: number = 1,
  ): number {
    const zScore = this.Z_SCORES[confidenceLevel];
    // Convert annual volatility to daily
    const dailyVol = (annualVolatility / 100) / Math.sqrt(365);
    const periodVol = dailyVol * Math.sqrt(days);
    
    return Number((portfolioValue * periodVol * zScore).toFixed(2));
  }

  /**
   * Calculate Conditional Value at Risk (CVaR) / Expected Shortfall
   * Expected loss given that the loss exceeds VaR
   */
  calculateCVaR(
    portfolioValue: number,
    annualVolatility: number,
    confidenceLevel: 95 | 99 = 95,
  ): number {
    const alpha = 1 - (confidenceLevel / 100);
    const zScore = this.Z_SCORES[confidenceLevel];
    // Standard normal PDF at zScore
    const pdf = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * Math.pow(zScore, 2));
    
    const dailyVol = (annualVolatility / 100) / Math.sqrt(365);
    
    // CVaR approximation for normal distribution
    const cvarFactor = pdf / alpha;
    
    return Number((portfolioValue * dailyVol * cvarFactor).toFixed(2));
  }

  /**
   * Perform Stress Testing with predefined scenarios
   */
  performStressTests(
    portfolioValue: number,
    assets: AssetAllocation[],
  ): StressTestResultDto[] {
    const scenarios: StressTestScenario[] = [
      {
        name: 'Crypto Winter',
        description: 'Major market crash across all crypto assets',
        assetShocks: { USDT: -0.02, USDC: -0.01 }, // Stablecoins depeg slightly
        marketShock: -0.60, // 60% drop
      },
      {
        name: 'Regulatory Crackdown',
        description: 'Strict regulations impacting privacy and exchange tokens',
        assetShocks: { BNB: -0.40, XRP: -0.30, XMR: -0.50 },
        marketShock: -0.15,
      },
      {
        name: 'Stablecoin Depeg',
        description: 'Major stablecoin loses peg',
        assetShocks: { USDT: -0.30, USDC: -0.10, DAI: -0.10 },
        marketShock: -0.20, // Contagion effect
      },
      {
        name: 'Tech Bull Run',
        description: 'Positive market sentiment driven by tech adoption',
        assetShocks: { ETH: 0.40, SOL: 0.50 },
        marketShock: 0.25,
      },
    ];

    return scenarios.map((scenario) => {
      let projectedValue = 0;

      for (const asset of assets) {
        // Determine shock factor for this asset
        const shock = scenario.assetShocks[asset.symbol] !== undefined
          ? scenario.assetShocks[asset.symbol]
          : scenario.marketShock;
        
        projectedValue += asset.value * (1 + shock);
      }

      const projectedPnL = projectedValue - portfolioValue;

      return {
        scenarioName: scenario.name,
        description: scenario.description,
        projectedValue: Number(projectedValue.toFixed(2)),
        projectedPnL: Number(projectedPnL.toFixed(2)),
        percentageChange: Number(((projectedPnL / portfolioValue) * 100).toFixed(2)),
      };
    });
  }
}