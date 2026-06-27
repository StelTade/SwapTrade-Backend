import { PricePredictionService } from './price-prediction.service';

describe('PricePredictionService', () => {
  it('should return 7-day predictions with deterministic output', async () => {
    const service = new PricePredictionService();
    const result1 = await service.get7DayPricePredictionsForUser('user-1');
    const result2 = await service.get7DayPricePredictionsForUser('user-1');

    expect(result1.horizonDays).toBe(7);
    expect(result1.predictions).toHaveLength(3);
    expect(result1.predictions.map((p) => p.asset)).toEqual([
      'BTC/USD',
      'ETH/USD',
      'USDC/USD',
    ]);

    // Deterministic
    expect(result2).toEqual(result1);

    for (const p of result1.predictions) {
      expect(p.predictedPrice).toBeGreaterThan(0);
      expect(p.confidence).toBeGreaterThanOrEqual(0.15);
      expect(p.confidence).toBeLessThanOrEqual(0.9);
    }
  });
});
