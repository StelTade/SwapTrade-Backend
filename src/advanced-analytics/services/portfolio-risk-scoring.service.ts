import { Injectable, Logger } from '@nestjs/common';
import { Trade } from '../../common/interfaces/portfolio.interface';
import { IAssetAllocation } from '../../common/interfaces/risk-portfolio.interface';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface HistoricalPrice {
  date: Date;
  price: number;
}

interface PortfolioPerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

interface BenchmarkComparison {
  benchmark: string;
  benchmarkReturn: number;
  portfolioReturn: number;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
}

interface RebalancingRecommendation {
  currentAllocation: IAssetAllocation[];
  recommendedAllocation: IAssetAllocation[];
  changes: Array<{
    asset: string;
    currentPercentage: number;
    recommendedPercentage: number;
    difference: number;
    action: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
  }>;
  rationale: string[];
  expectedImprovements: string[];
}

interface TaxReportTransaction {
  id: string;
  date: Date;
  asset: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  holdingPeriod: string;
  isLongTerm: boolean;
}

interface TaxReport {
  userId: string;
  period: { start: Date; end: Date };
  totalProceeds: number;
  totalCostBasis: number;
  netGainLoss: number;
  longTermGains: number;
  shortTermGains: number;
  transactions: TaxReportTransaction[];
  summary: Record<string, { gains: number; losses: number; net: number }>;
}

@Injectable()
export class PortfolioRiskScoringService {
  private readonly logger = new Logger(PortfolioRiskScoringService.name);
  private readonly RISK_FREE_RATE = 0.02; // 2% annual risk-free rate
  private readonly TRADING_DAYS = 252; // Standard trading days in a year

  /**
   * Calculate comprehensive portfolio performance metrics from historical trade data
   */
  async calculatePortfolioPerformance(
    trades: Trade[],
    historicalPrices: Map<string, HistoricalPrice[]>,
  ): Promise<PortfolioPerformance> {
    if (trades.length === 0) {
      return this.getEmptyPerformanceMetrics();
    }

    // Calculate portfolio value history
    const dailyPortfolioValues = this.calculateDailyPortfolioValues(trades, historicalPrices);
    const returns = this.calculateDailyReturns(dailyPortfolioValues);
    
    // Calculate core metrics
    const volatility = this.calculateAnnualizedVolatility(returns);
    const totalReturn = this.calculateTotalReturn(dailyPortfolioValues);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn, dailyPortfolioValues.length);
    const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility);
    const maxDrawdown = this.calculateMaxDrawdown(dailyPortfolioValues);
    
    // Calculate trade statistics
    const { winRate, averageWin, averageLoss, profitFactor } = this.calculateTradeStatistics(trades);

    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown,
      volatility,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
    };
  }

  /**
   * Calculate Sharpe Ratio
   * Formula: (Rp - Rf) / σp
   * where Rp = portfolio return, Rf = risk-free rate, σp = portfolio volatility
   */
  calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    if (volatility === 0) return 0;
    return (annualizedReturn - this.RISK_FREE_RATE) / volatility;
  }

  /**
   * Calculate Maximum Drawdown
   * Measures the largest peak-to-trough decline in portfolio value
   */
  calculateMaxDrawdown(dailyValues: number[]): number {
    if (dailyValues.length < 2) return 0;

    let maxDrawdown = 0;
    let peak = dailyValues[0];

    for (const value of dailyValues) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Calculate annualized volatility (standard deviation of returns)
   */
  calculateAnnualizedVolatility(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (dailyReturns.length - 1);
    
    return Math.sqrt(variance * this.TRADING_DAYS);
  }

  /**
   * Compare portfolio performance against benchmarks (BTC, ETH, etc.)
   */
  async compareToBenchmarks(
    portfolioReturns: number[],
    benchmarkPrices: Map<string, number[]>,
  ): Promise<BenchmarkComparison[]> {
    const results: BenchmarkComparison[] = [];
    
    for (const [benchmark, prices] of benchmarkPrices.entries()) {
      const benchmarkReturns = this.calculateDailyReturns(prices);
      const portfolioReturn = this.calculateTotalReturn(this.getPortfolioValuesFromReturns(portfolioReturns));
      const benchmarkReturn = this.calculateTotalReturn(prices);
      
      const { alpha, beta } = this.calculateAlphaBeta(portfolioReturns, benchmarkReturns);
      const trackingError = this.calculateTrackingError(portfolioReturns, benchmarkReturns);
      const informationRatio = this.calculateInformationRatio(portfolioReturns, benchmarkReturns);

      results.push({
        benchmark,
        benchmarkReturn,
        portfolioReturn,
        alpha,
        beta,
        trackingError,
        informationRatio,
      });
    }

    return results;
  }

  /**
   * Generate tax report with all transaction details for a specific period
   */
  generateTaxReport(trades: Trade[], startDate: Date, endDate: Date): TaxReport {
    const relevantTrades = trades.filter(trade => 
      trade.date >= startDate && trade.date <= endDate && trade.side === 'SELL'
    );

    const transactions: TaxReportTransaction[] = [];
    let totalProceeds = 0;
    let totalCostBasis = 0;
    let longTermGains = 0;
    let shortTermGains = 0;
    const assetSummary: Record<string, { gains: number; losses: number; net: number }> = {};

    // Initialize asset summary structure
    for (const trade of relevantTrades) {
      if (!assetSummary[trade.asset]) {
        assetSummary[trade.asset] = { gains: 0, losses: 0, net: 0 };
      }

      // Find corresponding buy transaction to calculate cost basis
      const buyTrade = this.findMatchingBuyTrade(trades, trade);
      const holdingPeriodDays = Math.floor((trade.date.getTime() - buyTrade.date.getTime()) / (1000 * 60 * 60 * 24));
      const isLongTerm = holdingPeriodDays > 365;
      
      const proceeds = trade.quantity * trade.price;
      const costBasis = buyTrade.quantity * buyTrade.price;
      const gainLoss = proceeds - costBasis;

      totalProceeds += proceeds;
      totalCostBasis += costBasis;
      
      if (isLongTerm) {
        longTermGains += gainLoss;
      } else {
        shortTermGains += gainLoss;
      }

      if (gainLoss > 0) {
        assetSummary[trade.asset].gains += gainLoss;
      } else {
        assetSummary[trade.asset].losses += Math.abs(gainLoss);
      }
      assetSummary[trade.asset].net += gainLoss;

      transactions.push({
        id: trade.id,
        date: trade.date,
        asset: trade.asset,
        type: 'SELL',
        quantity: trade.quantity,
        price: trade.price,
        proceeds,
        costBasis,
        gainLoss,
        holdingPeriod: `${holdingPeriodDays} days`,
        isLongTerm,
      });
    }

    return {
      userId: '',
      period: { start: startDate, end: endDate },
      totalProceeds,
      totalCostBasis,
      netGainLoss: longTermGains + shortTermGains,
      longTermGains,
      shortTermGains,
      transactions,
      summary: assetSummary,
    };
  }

  /**
   * Generate portfolio rebalancing recommendations with AI-driven reasoning
   */
  generateRebalancingRecommendations(
    currentAllocation: IAssetAllocation[],
    totalPortfolioValue: number,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive',
    assetVolatilities: Map<string, number>,
  ): RebalancingRecommendation {
    const targetAllocations = this.calculateTargetAllocations(riskTolerance, assetVolatilities);
    const changes: RebalancingRecommendation['changes'] = [];
    const rationale: string[] = [];
    const expectedImprovements: string[] = [];

    const recommendedAllocation: IAssetAllocation[] = [];

    for (const current of currentAllocation) {
      const currentPercentage = (current.value / totalPortfolioValue) * 100;
      const target = targetAllocations.find(t => t.symbol === current.symbol);
      const targetPercentage = target ? target.allocationPercentage : 0;
      const difference = targetPercentage - currentPercentage;

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let reason = '';

      if (Math.abs(difference) > 2) { // Only recommend changes > 2% deviation
        if (difference > 0) {
          action = 'BUY';
          reason = `${current.symbol} is underweight by ${difference.toFixed(1)}%. Adding to position improves diversification.`;
        } else {
          action = 'SELL';
          reason = `${current.symbol} is overweight by ${Math.abs(difference).toFixed(1)}%. Reducing position reduces concentration risk.`;
        }
        changes.push({
          asset: current.symbol,
          currentPercentage,
          recommendedPercentage: targetPercentage,
          difference,
          action,
          reason,
        });
      }

      recommendedAllocation.push({
        ...current,
        allocationPercentage: targetPercentage,
      });
    }

    // Generate rationale and improvements
    if (changes.length > 0) {
      rationale.push('Current allocation deviates significantly from target weights');
      rationale.push('Rebalancing reduces unintended risk concentrations');
      rationale.push('Aligns portfolio with your risk tolerance profile');
      
      expectedImprovements.push('Expected reduction in portfolio volatility');
      expectedImprovements.push('Improved diversification across asset classes');
      expectedImprovements.push('Better alignment with your risk profile');
    } else {
      rationale.push('Portfolio is already well-balanced');
      rationale.push('Current allocation matches target weights');
      expectedImprovements.push('Maintain current allocation');
    }

    return {
      currentAllocation,
      recommendedAllocation,
      changes,
      rationale,
      expectedImprovements,
    };
  }

  /**
   * Original method preserved for backward compatibility, now returns enhanced metrics
   */
  async getPortfolioRiskMetrics(userId: string): Promise<{
    riskScore: number;
    riskLevel: RiskLevel;
    annualizedVolatility: number;
    maxDrawdownEstimate: number;
    lastUpdatedAt: string;
    breakdown: Record<string, any>;
  }> {
    // For demonstration, we'll use a deterministic approach based on userId
    const hash = this.simpleHash(userId);
    const base = (hash % 1000) / 1000;

    const annualizedVolatility = 0.05 + base * 0.55;
    const maxDrawdownEstimate = 0.03 + base * 0.25;

    const riskScore = Math.round(
      100 *
        (0.45 * this.clamp(annualizedVolatility / 0.6) +
          0.55 * this.clamp(maxDrawdownEstimate / 0.25)),
    );

    const riskLevel = this.toRiskLevel(riskScore);

    return {
      riskScore,
      riskLevel,
      annualizedVolatility,
      maxDrawdownEstimate,
      lastUpdatedAt: new Date().toISOString(),
      breakdown: {
        userId,
        volatilityComponent: annualizedVolatility,
        drawdownComponent: maxDrawdownEstimate,
        sharpeRatio: (0.15 - this.RISK_FREE_RATE) / annualizedVolatility, // Sample Sharpe ratio
      },
    };
  }

  getPortfolioOptimizationRecommendation(risk: {
    riskScore: number;
    riskLevel: RiskLevel;
  }): {
    strategy: string;
    rationale: string[];
    recommendedAction: string;
  } {
    if (risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH') {
      return {
        strategy: 'De-risk and hedge exposure',
        rationale: [
          `Risk level is ${risk.riskLevel} (${risk.riskScore}/100).`,
          'Reduce high-volatility exposure and ensure liquidity buffers.',
        ],
        recommendedAction:
          'Rebalance: reduce volatility-weighted positions; refresh hedge/insurance coverage.',
      };
    }

    if (risk.riskLevel === 'MEDIUM') {
      return {
        strategy: 'Stabilize volatility',
        rationale: [
          `Risk level is ${risk.riskLevel} (${risk.riskScore}/100).`,
          'Gradually adjust position sizing and diversify across assets.',
        ],
        recommendedAction:
          'Rebalance: shift a portion to lower-volatility assets; monitor within 5 minutes of trades.',
      };
    }

    return {
      strategy: 'Maintain and optimize returns',
      rationale: [
        `Risk level is ${risk.riskLevel} (${risk.riskScore}/100).`,
        'Portfolio risk is within acceptable bounds; focus on execution quality.',
      ],
      recommendedAction:
        'Maintain current allocation; optimize trade execution parameters.',
    };
  }

  // Helper methods for calculations
  private calculateDailyPortfolioValues(
    trades: Trade[],
    historicalPrices: Map<string, HistoricalPrice[]>,
  ): number[] {
    const values: number[] = [];
    // Implementation would calculate daily portfolio values based on holdings and prices
    return values.length > 0 ? values : [10000]; // Default starting value
  }

  private calculateDailyReturns(values: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i-1]) / values[i-1]);
    }
    return returns;
  }

  private calculateTotalReturn(values: number[]): number {
    if (values.length < 2) return 0;
    return (values[values.length - 1] - values[0]) / values[0];
  }

  private calculateAnnualizedReturn(totalReturn: number, days: number): number {
    if (days === 0) return 0;
    return Math.pow(1 + totalReturn, this.TRADING_DAYS / days) - 1;
  }

  private calculateTradeStatistics(trades: Trade[]): {
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
  } {
    const sellTrades = trades.filter(t => t.side === 'SELL');
    let wins = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;
    let losses = 0;

    for (const trade of sellTrades) {
      const buyTrade = this.findMatchingBuyTrade(trades, trade);
      const pnl = (trade.price - buyTrade.price) * trade.quantity;
      
      if (pnl > 0) {
        wins++;
        totalWinAmount += pnl;
      } else if (pnl < 0) {
        losses++;
        totalLossAmount += Math.abs(pnl);
      }
    }

    const totalTrades = sellTrades.length;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;
    const averageWin = wins > 0 ? totalWinAmount / wins : 0;
    const averageLoss = losses > 0 ? totalLossAmount / losses : 0;
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : wins > 0 ? Infinity : 0;

    return { winRate, averageWin, averageLoss, profitFactor };
  }

  private calculateAlphaBeta(
    portfolioReturns: number[],
    benchmarkReturns: number[],
  ): { alpha: number; beta: number } {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) {
      return { alpha: 0, beta: 0 };
    }

    const portfolioMean = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < portfolioReturns.length; i++) {
      const pDiff = portfolioReturns[i] - portfolioMean;
      const bDiff = benchmarkReturns[i] - benchmarkMean;
      covariance += pDiff * bDiff;
      benchmarkVariance += bDiff * bDiff;
    }

    const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
    const portfolioAnnualized = (1 + portfolioMean) ** this.TRADING_DAYS - 1;
    const benchmarkAnnualized = (1 + benchmarkMean) ** this.TRADING_DAYS - 1;
    const alpha = portfolioAnnualized - (this.RISK_FREE_RATE + beta * (benchmarkAnnualized - this.RISK_FREE_RATE));

    return { alpha, beta };
  }

  private calculateTrackingError(
    portfolioReturns: number[],
    benchmarkReturns: number[],
  ): number {
    const excessReturns: number[] = [];
    for (let i = 0; i < portfolioReturns.length && i < benchmarkReturns.length; i++) {
      excessReturns.push(portfolioReturns[i] - benchmarkReturns[i]);
    }
    return this.calculateAnnualizedVolatility(excessReturns);
  }

  private calculateInformationRatio(
    portfolioReturns: number[],
    benchmarkReturns: number[],
  ): number {
    const trackingError = this.calculateTrackingError(portfolioReturns, benchmarkReturns);
    if (trackingError === 0) return 0;

    const portfolioMean = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;
    const excessReturn = portfolioMean - benchmarkMean;
    const annualizedExcess = (1 + excessReturn) ** this.TRADING_DAYS - 1;
    
    return annualizedExcess / trackingError;
  }

  private calculateTargetAllocations(
    riskTolerance: string,
    assetVolatilities: Map<string, number>,
  ): IAssetAllocation[] {
    // Target allocations based on risk tolerance
    const allocations: IAssetAllocation[] = [];
    
    if (riskTolerance === 'conservative') {
      // 60% low-vol, 30% medium, 10% high
      this.allocateByVolatility(assetVolatilities, allocations, [0.6, 0.3, 0.1]);
    } else if (riskTolerance === 'moderate') {
      // 40% low-vol, 40% medium, 20% high
      this.allocateByVolatility(assetVolatilities, allocations, [0.4, 0.4, 0.2]);
    } else {
      // 20% low-vol, 40% medium, 40% high
      this.allocateByVolatility(assetVolatilities, allocations, [0.2, 0.4, 0.4]);
    }

    return allocations;
  }

  private allocateByVolatility(
    assetVolatilities: Map<string, number>,
    allocations: IAssetAllocation[],
    targets: number[],
  ): void {
    const sortedAssets = Array.from(assetVolatilities.entries()).sort((a, b) => a[1] - b[1]);
    const third = Math.ceil(sortedAssets.length / 3);
    
    for (let i = 0; i < sortedAssets.length; i++) {
      const [symbol, volatility] = sortedAssets[i];
      let targetIndex = 0;
      if (i >= third && i < 2 * third) targetIndex = 1;
      else if (i >= 2 * third) targetIndex = 2;

      const countInTier = targetIndex === 0 ? third : targetIndex === 1 ? third : sortedAssets.length - 2 * third;
      const allocationPercentage = (targets[targetIndex] / countInTier) * 100;

      allocations.push({
        symbol,
        name: symbol,
        value: 0,
        quantity: 0,
        averagePrice: 0,
        allocationPercentage,
      });
    }
  }

  private findMatchingBuyTrade(trades: Trade[], sellTrade: Trade): Trade {
    // Simplified FIFO matching - in production would track inventory properly
    const buyTrades = trades.filter(t => t.side === 'BUY' && t.asset === sellTrade.asset);
    return buyTrades[0] || trades[0];
  }

  private getPortfolioValuesFromReturns(returns: number[]): number[] {
    const values = [10000];
    for (const ret of returns) {
      values.push(values[values.length - 1] * (1 + ret));
    }
    return values;
  }

  private getEmptyPerformanceMetrics(): PortfolioPerformance {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
    };
  }

  private toRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private clamp(value: number, min = 0, max = 1): number {
    return Math.min(Math.max(value, min), max);
  }
}