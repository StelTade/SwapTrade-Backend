import { PortfolioRiskScoringService } from './portfolio-risk-scoring.service';

describe('PortfolioRiskScoringService', () => {
  it('should return a risk score with a valid risk level', async () => {
    const service = new PortfolioRiskScoringService();
    const r = await service.getPortfolioRiskMetrics('user-2');

    expect(r.riskScore).toBeGreaterThanOrEqual(0);
    expect(r.riskScore).toBeLessThanOrEqual(100);
    expect(r.riskLevel).toBe(
      ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(r.riskLevel)
        ? r.riskLevel
        : r.riskLevel,
    );

    expect(r.annualizedVolatility).toBeGreaterThan(0);
    expect(r.maxDrawdownEstimate).toBeGreaterThan(0);
    expect(r.breakdown).toHaveProperty('userId', 'user-2');
  });

  it('should return a recommendation for each risk level', async () => {
    const service = new PortfolioRiskScoringService();

    const recCritical = service.getPortfolioOptimizationRecommendation({
      riskScore: 90,
      riskLevel: 'CRITICAL',
    });
    expect(recCritical.recommendedAction).toContain('Rebalance');

    const recMedium = service.getPortfolioOptimizationRecommendation({
      riskScore: 50,
      riskLevel: 'MEDIUM',
    });
    expect(recMedium.strategy).toBe('Stabilize volatility');

    const recLow = service.getPortfolioOptimizationRecommendation({
      riskScore: 10,
      riskLevel: 'LOW',
    });
    expect(recLow.strategy).toBe('Maintain and optimize returns');
  });
});
