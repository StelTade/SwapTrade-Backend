import { Module } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { PricePredictionService } from './services/price-prediction/price-prediction.service';
import { PortfolioRiskScoringService } from './services/portfolio-risk-scoring.service';
import { UserBehaviorAnalysisService } from './services/user-behavior-analysis/user-behavior-analysis.service';
import { AnalyticsExportService } from './services/analytics-export/analytics-export.service';

@Module({
  providers: [
    AdvancedAnalyticsService,
    PricePredictionService,
    PortfolioRiskScoringService,
    UserBehaviorAnalysisService,
    AnalyticsExportService,
  ],
  exports: [AdvancedAnalyticsService],
})
export class AdvancedAnalyticsModule {}
 