import { Injectable, Logger } from '@nestjs/common';
import { PortfolioRiskScoringService } from './services/portfolio-risk-scoring.service';
import { PricePredictionService } from './services/price-prediction/price-prediction.service';
import { UserBehaviorAnalysisService } from './services/user-behavior-analysis/user-behavior-analysis.service';
import { AnalyticsExportService } from './services/analytics-export/analytics-export.service';
import { Trade } from '../common/interfaces/portfolio.interface';
import { IAssetAllocation } from '../common/interfaces/risk-portfolio.interface';

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(
    private readonly pricePrediction: PricePredictionService,
    private readonly portfolioRisk: PortfolioRiskScoringService,
    private readonly behaviorAnalysis: UserBehaviorAnalysisService,
    private readonly exportService: AnalyticsExportService,
  ) {}

  async getAdvancedRiskMetrics(userId: string): Promise<any> {
    // Baseline: assemble risk + volatility + simple anomaly hints.
    const [risk, behavior] = await Promise.all([
      this.portfolioRisk.getPortfolioRiskMetrics(userId),
      this.behaviorAnalysis.getUserBehaviorSummary(userId),
    ]);

    return {
      userId,
      ...risk,
      behavior,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get comprehensive portfolio performance metrics
   */
  async getPortfolioPerformance(trades: Trade[], historicalPrices: Map<string, any[]>): Promise<any> {
    this.logger.debug(`Calculating portfolio performance for ${trades.length} trades`);
    const performance = await this.portfolioRisk.calculatePortfolioPerformance(trades, historicalPrices);
    
    return {
      performance,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Compare portfolio performance against benchmarks (BTC, ETH)
   */
  async getBenchmarkComparison(
    portfolioReturns: number[],
    benchmarkPrices: Map<string, number[]>
  ): Promise<any> {
    this.logger.debug(`Comparing portfolio against ${benchmarkPrices.size} benchmarks`);
    const comparisons = await this.portfolioRisk.compareToBenchmarks(portfolioReturns, benchmarkPrices);
    
    return {
      benchmarks: comparisons,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate tax report for a specific time period
   */
  generateTaxReport(trades: Trade[], startDate: Date, endDate: Date): any {
    this.logger.debug(`Generating tax report for period ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const taxReport = this.portfolioRisk.generateTaxReport(trades, startDate, endDate);
    
    return {
      ...taxReport,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get portfolio rebalancing recommendations
   */
  getRebalancingRecommendations(
    currentAllocation: IAssetAllocation[],
    totalPortfolioValue: number,
    riskTolerance: 'conservative' | 'moderate' | 'aggressive',
    assetVolatilities: Map<string, number>
  ): any {
    this.logger.debug(`Generating rebalancing recommendations for ${currentAllocation.length} assets`);
    const recommendations = this.portfolioRisk.generateRebalancingRecommendations(
      currentAllocation,
      totalPortfolioValue,
      riskTolerance,
      assetVolatilities
    );
    
    return {
      ...recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  async getPortfolioOptimization(userId: string): Promise<any> {
    // Baseline: combine 7-day price predictions + risk scoring.
    const [risk, predictions] = await Promise.all([
      this.portfolioRisk.getPortfolioRiskMetrics(userId),
      this.pricePrediction.get7DayPricePredictionsForUser(userId),
    ]);

    return {
      userId,
      risk,
      predictions,
      recommendation:
        this.portfolioRisk.getPortfolioOptimizationRecommendation(risk),
      generatedAt: new Date().toISOString(),
    };
  }

  async exportUserAnalytics(
    userId: string,
    format: 'csv' | 'xlsx',
  ): Promise<{
    mimeType: string;
    fileName: string;
    buffer: Buffer;
  }> {
    this.logger.debug(`Exporting analytics for user ${userId} as ${format}`);
    const analytics = await this.getAdvancedRiskMetrics(userId);
    return this.exportService.exportAnalytics(analytics, format);
  }

  /**
   * Export tax report with all transaction details
   */
  async exportTaxReport(
    trades: Trade[],
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'xlsx',
  ): Promise<{
    mimeType: string;
    fileName: string;
    buffer: Buffer;
  }> {
    this.logger.debug(`Exporting tax report as ${format}`);
    const taxReport = this.generateTaxReport(trades, startDate, endDate);
    return this.exportService.exportAnalytics(taxReport, format);
  }
}