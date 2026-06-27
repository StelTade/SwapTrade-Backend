import { AnalyticsExportService } from './services/analytics-export/analytics-export.service';
import { PortfolioRiskScoringService } from './services/portfolio-risk-scoring.service';
import { PricePredictionService } from './services/price-prediction/price-prediction.service';
import { UserBehaviorAnalysisService } from './services/user-behavior-analysis/user-behavior-analysis.service';
import { AdvancedAnalyticsService } from './advanced-analytics.service';

describe('AdvancedAnalyticsService', () => {
  it('should assemble risk metrics with behavior summary and generatedAt', async () => {
    const service = new AdvancedAnalyticsService(
      new PricePredictionService(),
      new PortfolioRiskScoringService(),
      new UserBehaviorAnalysisService(),
      new AnalyticsExportService(),
    );

    const out = await service.getAdvancedRiskMetrics('user-4');
    expect(out.userId).toBe('user-4');
    expect(out).toHaveProperty('riskScore');
    expect(out).toHaveProperty('riskLevel');
    expect(out.behavior).toHaveProperty('anomalyScore');
    expect(typeof out.generatedAt).toBe('string');
  });

  it('should export analytics as CSV', async () => {
    const service = new AdvancedAnalyticsService(
      new PricePredictionService(),
      new PortfolioRiskScoringService(),
      new UserBehaviorAnalysisService(),
      new AnalyticsExportService(),
    );

    const out = await service.exportUserAnalytics('user-5', 'csv');
    expect(out.mimeType).toBe('text/csv');
    expect(out.buffer.length).toBeGreaterThan(0);
    expect(out.fileName).toMatch(/\.csv$/);
  });
});
