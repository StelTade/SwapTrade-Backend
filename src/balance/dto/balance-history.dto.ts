import { IsString, IsNumber, IsOptional, IsISO8601, Max, Min, IsBoolean, ArrayMinSize } from 'class-validator';
import { IsAssetType } from '../../common/validation';

export class BalanceHistoryQueryDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsAssetType()
  asset?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class BalanceHistoryResponseDto {
  @ArrayMinSize(0)
  data: BalanceHistoryEntryDto[];

  @IsNumber()
  total: number;

  @IsNumber()
  limit: number;

  @IsNumber()
  offset: number;

  @IsBoolean()
  hasMore: boolean;
}

export class BalanceHistoryEntryDto {
  @IsAssetType()
  asset: string;

  @IsNumber()
  amountChanged: number;

  @IsString()
  reason: string;

  @IsISO8601()
  timestamp: string;

  @IsNumber()
  resultingBalance: number;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  relatedOrderId?: string;
}
