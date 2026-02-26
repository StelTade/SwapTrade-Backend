
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, Min, Max, ArrayMinSize, IsISO8601 } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class AssetAllocation {
  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsAssetType()
  symbol: string;

  @ApiProperty({ example: 'Bitcoin', description: 'Asset name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 45000.5, description: 'Current value of the asset' })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 1.5, description: 'Quantity of the asset held' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 30000, description: 'Average purchase price' })
  @IsNumber()
  @Min(0)
  averagePrice: number;

  @ApiProperty({ example: 75.5, description: 'Percentage of portfolio allocation' })
  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPercentage: number;
}

export class PortfolioSummaryDto {
  @ApiProperty({ example: 59600.75, description: 'Total value of the portfolio' })
  @IsNumber()
  @Min(0)
  totalValue: number;

  @ApiProperty({ type: [AssetAllocation], description: 'List of asset allocations' })
  @ArrayMinSize(0)
  assets: AssetAllocation[];

  @ApiProperty({ example: 3, description: 'Number of assets in the portfolio' })
  @IsNumber()
  @Min(0)
  count: number;

  @ApiProperty({ example: '2026-01-22T10:30:00Z', description: 'Timestamp of portfolio snapshot' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ example: '2026-01-22T10:25:00Z', description: 'Timestamp when prices were fetched' })
  @IsISO8601()
  pricesFetchedAt: string;
}
