import { ApiProperty } from '@nestjs/swagger';

export class AssetAllocation {
  @ApiProperty({ example: 'BTC' })
  symbol: string;

  @ApiProperty({ example: 'Bitcoin' })
  name: string;

  @ApiProperty({ example: 45000.5 })
  value: number;

  @ApiProperty({ example: 1.5 })
  quantity: number;

  @ApiProperty({ example: 30000 })
  averagePrice: number;

  @ApiProperty({ example: 75.5 })
  allocationPercentage: number;
}

export class PortfolioSummaryDto {
  @ApiProperty({ example: 59600.75 })
  totalValue: number;

  @ApiProperty({ type: [AssetAllocation] })
  assets: AssetAllocation[];

  @ApiProperty({ example: 3 })
  count: number;

  @ApiProperty({ example: '2026-01-22T10:30:00Z' })
  timestamp: string;

  @ApiProperty({ example: '2026-01-22T10:25:00Z' })
  pricesFetchedAt: string;
}
