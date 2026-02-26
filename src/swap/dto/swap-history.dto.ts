import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SwapStatus } from '../entities/swap-history.entity';

export class SwapHistoryQueryDto {
  @ApiPropertyOptional({ enum: SwapStatus })
  @IsOptional()
  @IsEnum(SwapStatus)
  status?: SwapStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromAsset?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toAsset?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class SwapHistoryEntryDto {
  id: string;
  userId: string;
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  amountOut: number | null;
  quotedRate: number;
  executedRate: number | null;
  slippageTolerance: number;
  actualSlippage: number | null;
  priceImpact: number | null;
  status: SwapStatus;
  swapType: string;
  route: string[] | null;
  retryCount: number;
  errorMessage: string | null;
  jobId: string | null;
  batchId: string | null;
  executedAt: string | null;
  settledAt: string | null;
  createdAt: string;
}

export class SwapHistoryResponseDto {
  data: SwapHistoryEntryDto[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}