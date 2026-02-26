import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsISO8601, Min, Max, ValidateNested, IsString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { IsAssetSymbol } from '../../common/validation/custom-validators';

export class PortfolioRiskMetadataDto {
  @ApiProperty({ example: 'BTC' })
  @IsAssetSymbol()
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

export class VaRMetricsDto {
  @ApiProperty({ example: 1250.50, description: 'Parametric Value at Risk (95% confidence)' })
  @IsNumber()
  parametric: number;

  @ApiProperty({ example: 1300.75, description: 'Historical Value at Risk (95% confidence)' })
  @IsNumber()
  historical: number;

  @ApiProperty({ example: 95, description: 'Confidence level for VaR calculation' })
  @IsNumber()
  confidenceLevel: number;
}

export class StressTestResultDto {
  @ApiProperty({ example: 'Crypto Winter' })
  @IsString()
  scenarioName: string;

  @ApiProperty({ example: 'Major market crash across all crypto assets' })
  @IsString()
  description: string;

  @ApiProperty({ example: -25000.00 })
  @IsNumber()
  projectedPnL: number;

  @ApiProperty({ example: 22500.00 })
  @IsNumber()
  projectedValue: number;

  @ApiProperty({ example: -52.5 })
  @IsNumber()
  percentageChange: number;
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

  @ApiProperty({ type: VaRMetricsDto })
  @ValidateNested()
  @Type(() => VaRMetricsDto)
  valueAtRisk: VaRMetricsDto;

  @ApiProperty({ example: 1500.00, description: 'Conditional Value at Risk (Expected Shortfall)' })
  @IsNumber()
  conditionalValueAtRisk: number;

  @ApiProperty({ type: [StressTestResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StressTestResultDto)
  stressTestResults: StressTestResultDto[];

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
