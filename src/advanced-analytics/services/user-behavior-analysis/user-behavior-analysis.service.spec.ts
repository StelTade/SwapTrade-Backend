import { UserBehaviorAnalysisService } from './user-behavior-analysis.service';

describe('UserBehaviorAnalysisService', () => {
  it('should return deterministic anomalyScore and alerts', async () => {
    const service = new UserBehaviorAnalysisService();
    const r1 = await service.getUserBehaviorSummary('user-3');
    const r2 = await service.getUserBehaviorSummary('user-3');

    expect(r1).toEqual(r2);
    expect(r1.anomalyScore).toBeGreaterThanOrEqual(0);
    expect(r1.anomalyScore).toBeLessThanOrEqual(100);

    if (r1.unusualTradingPattern) {
      expect(r1.alerts.length).toBeGreaterThan(0);
      expect(r1.alerts[0]).toHaveProperty('type', 'UNUSUAL_PATTERN');
    } else {
      expect(r1.alerts).toHaveLength(0);
    }
  });
});

