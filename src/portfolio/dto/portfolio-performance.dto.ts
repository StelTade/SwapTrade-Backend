import { ApiProperty } from '@nestjs/swagger';

export class AssetPerformance {
  @ApiProperty({ example: 'BTC' })
  symbol: string;

  @ApiProperty({ example: 15000.5 })
  totalGain: number;

  @ApiProperty({ example: 0 })
  totalLoss: number;

  @ApiProperty({ example: 50.02 })
  roi: number;

  @ApiProperty({ example: 30000 })
  costBasis: number;

  @ApiProperty({ example: 45000.5 })
  currentValue: number;
}

export class PortfolioPerformanceDto {
  @ApiProperty({ example: 18500.75 })
  totalGain: number;

  @ApiProperty({ example: 250.0 })
  totalLoss: number;

  @ApiProperty({ example: 35.4 })
  roi: number;

  @ApiProperty({ example: 51500.0 })
  totalCostBasis: number;

  @ApiProperty({ example: 69750.75 })
  totalCurrentValue: number;

  @ApiProperty({ example: 18250.75 })
  netGain: number;

  @ApiProperty({ type: [AssetPerformance] })
  assetPerformance: AssetPerformance[];

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  timestamp: string;

  @ApiProperty({ example: '2026-01-01T00:00:00Z', required: false })
  startDate?: string;

  @ApiProperty({ example: '2026-01-22T23:59:59Z', required: false })
  endDate?: string;
}
