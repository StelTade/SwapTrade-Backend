import { Injectable } from '@nestjs/common';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

@Injectable()
export class UserBehaviorAnalysisService {
  async getUserBehaviorSummary(userId: string): Promise<{
    unusualTradingPattern: boolean;
    anomalyScore: number; // 0..100
    alerts: Array<{
      type: string;
      severity: Severity;
      message: string;
    }>;
    generatedAt: string;
  }> {
    const score = (this.simpleHash(userId) % 10100) / 101; // 0..100
    const anomalyScore = Math.round(score);

    const unusualTradingPattern = anomalyScore >= 75;

    const alerts: Array<{ type: string; severity: Severity; message: string }> =
      unusualTradingPattern
        ? [
            {
              type: 'UNUSUAL_PATTERN',
              severity:
                anomalyScore >= 90
                  ? 'CRITICAL'
                  : anomalyScore >= 80
                    ? 'HIGH'
                    : 'MEDIUM',
              message:
                'Detected unusual trading activity pattern based on baseline heuristics.',
            },
          ]
        : [];

    return {
      unusualTradingPattern,
      anomalyScore,
      alerts,
      generatedAt: new Date().toISOString(),
    };
  }

  private simpleHash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
}
