import {
  IsArray,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchSwapLegDto {
  @ApiProperty({ example: 'USDT' })
  @IsString()
  from: string;

  @ApiProperty({ example: 'BTC' })
  @IsString()
  to: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 0.005 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5)
  slippageTolerance?: number;
}

export class BatchSwapDto {
  @ApiProperty({ example: 'user-uuid-123' })
  @IsString()
  userId: string;

  @ApiProperty({ type: [BatchSwapLegDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => BatchSwapLegDto)
  swaps: BatchSwapLegDto[];

  /**
   * When true, all swaps in the batch succeed or all are rolled back.
   */
  @ApiPropertyOptional({
    example: true,
    description: 'All-or-nothing: roll back everything if any leg fails',
  })
  @IsOptional()
  @IsBoolean()
  atomic?: boolean;
}

export class BatchSwapResponseDto {
  @ApiProperty()
  batchId: string;

  @ApiProperty()
  jobIds: string[];

  @ApiProperty()
  queued: number;

  @ApiProperty()
  estimatedProcessingMs: number;
}