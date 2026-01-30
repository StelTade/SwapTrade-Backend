
import { IsString, IsNumber, IsDate, IsOptional, ArrayMinSize, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsAssetType } from '../../common/validation';

class CurrentBalanceDto {
  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsAssetType()
  asset: string;

  @ApiProperty({ example: 1.5, description: 'Current amount held' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 10, description: 'Number of trades for this asset' })
  @IsNumber()
  trades: number;

  @ApiProperty({ example: 0.25, description: 'Profit and loss for this asset' })
  @IsNumber()
  pnl: number;
}

export class PortfolioStatsDto {
  @ApiProperty({ example: '123', description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 25, description: 'Total number of trades' })
  @IsNumber()
  totalTrades: number;

  @ApiProperty({ example: 1.5, description: 'Cumulative profit and loss' })
  @IsNumber()
  cumulativePnL: number;

  @ApiProperty({ example: 10000, description: 'Total trade volume' })
  @IsNumber()
  totalTradeVolume: number;

  @ApiPropertyOptional({ example: '2026-01-22T10:30:00Z', description: 'Date of last trade (nullable)' })
  @IsDate()
  @IsOptional()
  lastTradeDate: Date | null;

  @ApiProperty({ type: [CurrentBalanceDto], description: 'Current balances for each asset' })
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CurrentBalanceDto)
  currentBalances: CurrentBalanceDto[];
}