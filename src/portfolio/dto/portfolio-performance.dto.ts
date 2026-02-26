import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, ArrayMinSize, IsISO8601, IsOptional } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class AssetPerformance {
  @ApiProperty({ example: 'BTC' })
  @IsAssetType()
  symbol: string;

  @ApiProperty({ example: 15000.5 })
  @IsNumber()
  @Min(0)
  totalGain: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  totalLoss: number;

  @ApiProperty({ example: 50.02 })
  @IsNumber()
  roi: number;

  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(0)
  costBasis: number;

  @ApiProperty({ example: 45000.5 })
  @IsNumber()
  @Min(0)
  currentValue: number;
}

export class PortfolioPerformanceDto {
  @ApiProperty({ example: 18500.75 })
  @IsNumber()
  @Min(0)
  totalGain: number;

  @ApiProperty({ example: 250.0 })
  @IsNumber()
  @Min(0)
  totalLoss: number;

  @ApiProperty({ example: 35.4 })
  @IsNumber()
  roi: number;

  @ApiProperty({ example: 51500.0 })
  @IsNumber()
  @Min(0)
  totalCostBasis: number;

  @ApiProperty({ example: 69750.75 })
  @IsNumber()
  @Min(0)
  totalCurrentValue: number;

  @ApiProperty({ example: 18250.75 })
  @IsNumber()
  netGain: number;

  @ApiProperty({ type: [AssetPerformance] })
  @ArrayMinSize(0)
  assetPerformance: AssetPerformance[];

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ example: '2026-01-01T00:00:00Z', required: false })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiProperty({ example: '2026-01-22T23:59:59Z', required: false })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
