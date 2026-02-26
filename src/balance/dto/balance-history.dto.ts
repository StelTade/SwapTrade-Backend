
import { IsString, IsNumber, IsOptional, IsISO8601, Max, Min, IsBoolean, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsAssetType } from '../../common/validation';

export class BalanceHistoryQueryDto {
  @ApiPropertyOptional({ example: '2024-01-01T00:00:00Z', description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-01-31T23:59:59Z', description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ example: 'BTC', description: 'Asset symbol' })
  @IsOptional()
  @IsAssetType()
  asset?: string;

  @ApiPropertyOptional({ example: 50, description: 'Results per page (default: 50, max: 1000)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 0, description: 'Pagination offset (default: 0)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class BalanceHistoryEntryDto {
  @ApiProperty({ example: 'BTC', description: 'Asset symbol' })
  @IsAssetType()
  asset: string;

  @ApiProperty({ example: 0.5, description: 'Amount changed in this entry' })
  @IsNumber()
  amountChanged: number;

  @ApiProperty({ example: 'TRADE_EXECUTED', description: 'Reason for balance change' })
  @IsString()
  reason: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Timestamp of the change' })
  @IsISO8601()
  timestamp: string;

  @ApiProperty({ example: 1.5, description: 'Resulting balance after the change' })
  @IsNumber()
  resultingBalance: number;

  @ApiPropertyOptional({ example: 'tx_123', description: 'Transaction ID (if applicable)' })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({ example: 'order_456', description: 'Related order ID (if applicable)' })
  @IsString()
  @IsOptional()
  relatedOrderId?: string;
}

export class BalanceHistoryResponseDto {
  @ApiProperty({ type: [BalanceHistoryEntryDto], description: 'Array of balance change entries' })
  @ArrayMinSize(0)
  data: BalanceHistoryEntryDto[];

  @ApiProperty({ example: 150, description: 'Total number of entries matching filters' })
  @IsNumber()
  total: number;

  @ApiProperty({ example: 50, description: 'Number of entries returned per page' })
  @IsNumber()
  limit: number;

  @ApiProperty({ example: 0, description: 'Number of entries skipped' })
  @IsNumber()
  offset: number;

  @ApiProperty({ example: true, description: 'Whether more entries are available' })
  @IsBoolean()
  hasMore: boolean;
}
