import { Injectable } from '@nestjs/common';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

@Injectable()
export class PortfolioRiskScoringService {
  /**
   * Production note:
   * - This is a baseline implementation.
   * - It is intentionally deterministic-ish and fast, so the module is functional immediately.
   * - When real trade/portfolio data entities are wired, replace internals.
   */
  async getPortfolioRiskMetrics(userId: string): Promise<{
    riskScore: number;
    riskLevel: RiskLevel;
    annualizedVolatility: number;
    maxDrawdownEstimate: number;
    lastUpdatedAt: string;
    breakdown: Record<string, any>;
  }> {
    // Placeholder heuristics: stable across calls by hashing userId.
    const hash = this.simpleHash(userId);
    const base = (hash % 1000) / 1000; // 0..0.999

    const annualizedVolatility = 0.05 + base * 0.55; // 5% .. 60%
    const maxDrawdownEstimate = 0.03 + base * 0.25; // 3% .. 28%

    // Compose a 0..100 score.
    const riskScore = Math.round(
      100 * (0.45 * this.clamp(annualizedVolatility / 0.6) + 0.55 * this.clamp(maxDrawdownEstimate / 0.25)),
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
        recommendedAction: 'Rebalance: reduce volatility-weighted positions; refresh hedge/insurance coverage.',
      };
    }

    if (risk.riskLevel === 'MEDIUM') {
      return {
        strategy: 'Stabilize volatility',
        rationale: [
          `Risk level is ${risk.riskLevel} (${risk.riskScore}/100).`,
          'Gradually adjust position sizing and diversify across assets.',
        ],
        recommendedAction: 'Rebalance: shift a portion to lower-volatility assets; monitor within 5 minutes of trades.',
      };
    }

    return {
      strategy: 'Maintain and optimize returns',
      rationale: [
        `Risk level is ${risk.riskLevel} (${risk.riskScore}/100).`,
        'Portfolio risk is within acceptable bounds; focus on execution quality.',
      ],
      recommendedAction: 'Maintain current allocation; optimize trade execution parameters.',
    };
  }

  private toRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  private clamp(n: number): number {
    return Math.max(0, Math.min(1, n));
  }

  private simpleHash(input: string): number {
    // FNV-1a like small hash for deterministic behavior.
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }
}

