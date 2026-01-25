import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsISO8601, Min, Max } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class PortfolioRiskMetadataDto {
  @ApiProperty({ example: 'BTC' })
  @IsAssetType()
  largestHolding: string;
  
  @ApiProperty({ example: 75.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  largestHoldingPercentage: number;
  
  @ApiProperty({ example: 0.347 })
  @IsNumber()
  @Min(0)
  @Max(1)
  herfindahlIndex: number;
  
  @ApiProperty({ example: 2.88 })
  @IsNumber()
  @Min(1)
  effectiveAssets: number;
}

export class PortfolioRiskDto {
  @ApiProperty({
    example: 75.5,
    description: 'Percentage of portfolio in largest holding (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  concentrationRisk: number;

  @ApiProperty({
    example: 65.3,
    description:
      'Diversification score using Herfindahl index (0-100, higher is better)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  diversificationScore: number;

  @ApiProperty({
    example: 42.7,
    description:
      'Estimated volatility score based on asset volatilities (0-100)',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  volatilityEstimate: number;

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({
    example: {
      largestHolding: 'BTC',
      largestHoldingPercentage: 75.5,
      herfindahlIndex: 0.347,
      effectiveAssets: 2.88,
    },
  })
  @ApiProperty({ type: PortfolioRiskMetadataDto })
  metadata: PortfolioRiskMetadataDto;
}
