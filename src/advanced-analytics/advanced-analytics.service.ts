import { Injectable, Logger } from '@nestjs/common';
import { PortfolioRiskScoringService } from './services/portfolio-risk-scoring.service';
import { PricePredictionService } from './services/price-prediction/price-prediction.service';
import { UserBehaviorAnalysisService } from './services/user-behavior-analysis/user-behavior-analysis.service';
import { AnalyticsExportService } from './services/analytics-export/analytics-export.service';

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
}
