import { Injectable } from '@nestjs/common';

export type AssetPrediction = {
  asset: string;
  horizonDays: number;
  predictedPrice: number;
  confidence: number; // 0..1
};

@Injectable()
export class PricePredictionService {
  /**
   * Baseline implementation.
   * Uses deterministic pseudo predictions per user.
   *
   * Production upgrade path:
   * - Train TensorFlow.js models per asset (daily predictions, weekly retrain)
   * - Cache model outputs in Redis
   */
  async get7DayPricePredictionsForUser(userId: string): Promise<{
    horizonDays: number;
    predictions: AssetPrediction[];
    generatedAt: string;
  }> {
    const assets = ['BTC/USD', 'ETH/USD', 'USDC/USD'];
    const seed = this.simpleHash(userId);

    const predictions: AssetPrediction[] = assets.map((asset, idx) => {
      const x = ((seed + idx * 997) % 100000) / 100000; // 0..0.99999
      const basePrice = asset.startsWith('BTC')
        ? 45000
        : asset.startsWith('ETH')
          ? 3200
          : 1;
      const drift = (x - 0.5) * (asset.startsWith('USDC') ? 0.01 : 0.12);
      const predictedPrice = basePrice * (1 + drift);
      const confidence = Math.max(
        0.15,
        Math.min(0.9, 0.45 + (0.5 - Math.abs(x - 0.5))),
      );

      return {
        asset,
        horizonDays: 7,
        predictedPrice: Number(
          predictedPrice.toFixed(asset.startsWith('USDC') ? 4 : 2),
        ),
        confidence: Number(confidence.toFixed(3)),
      };
    });

    return {
      horizonDays: 7,
      predictions,
      generatedAt: new Date().toISOString(),
    };
  }

  private simpleHash(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
}
