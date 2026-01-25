import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, Min, Max, ArrayMinSize, IsISO8601 } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class AssetAllocation {
  @ApiProperty({ example: 'BTC' })
  @IsAssetType()
  symbol: string;

  @ApiProperty({ example: 'Bitcoin' })
  @IsString()
  name: string;

  @ApiProperty({ example: 45000.5 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 1.5 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 30000 })
  @IsNumber()
  @Min(0)
  averagePrice: number;

  @ApiProperty({ example: 75.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPercentage: number;
}

export class PortfolioSummaryDto {
  @ApiProperty({ example: 59600.75 })
  @IsNumber()
  @Min(0)
  totalValue: number;

  @ApiProperty({ type: [AssetAllocation] })
  @ArrayMinSize(0)
  assets: AssetAllocation[];

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(0)
  count: number;

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ example: '2026-01-22T10:25:00Z' })
  @IsISO8601()
  pricesFetchedAt: string;
}
