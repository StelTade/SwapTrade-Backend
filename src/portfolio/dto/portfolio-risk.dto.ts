import { ApiProperty } from '@nestjs/swagger';

export class PortfolioRiskDto {
  @ApiProperty({
    example: 75.5,
    description: 'Percentage of portfolio in largest holding (0-100)',
  })
  concentrationRisk: number;

  @ApiProperty({
    example: 65.3,
    description:
      'Diversification score using Herfindahl index (0-100, higher is better)',
  })
  diversificationScore: number;

  @ApiProperty({
    example: 42.7,
    description:
      'Estimated volatility score based on asset volatilities (0-100)',
  })
  volatilityEstimate: number;

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  timestamp: string;

  @ApiProperty({
    example: {
      largestHolding: 'BTC',
      largestHoldingPercentage: 75.5,
      herfindahlIndex: 0.347,
      effectiveAssets: 2.88,
    },
  })
  metadata: {
    largestHolding: string;
    largestHoldingPercentage: number;
    herfindahlIndex: number;
    effectiveAssets: number;
  };
}
