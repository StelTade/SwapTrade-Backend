import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSwapDto {
  @ApiProperty({ description: 'The ID of the user performing the swap' })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ example: 'USDT', description: 'Symbol of the asset to swap from' })
  @IsString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({ example: 'BTC', description: 'Symbol of the asset to swap to' })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 100, description: 'Amount to swap' })
  @IsNumber()
  @IsPositive()
  amount: number;

  /**
   * Maximum acceptable slippage as a fraction.
   * 0.005 = 0.5%, 0.01 = 1%. Defaults to 0.5%.
   */
  @ApiPropertyOptional({
    example: 0.005,
    description: 'Max slippage fraction (0.005 = 0.5%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.5) // Hard cap at 50% to prevent foot-guns
  slippageTolerance?: number;

  /**
   * When true, the swap is queued in the batch processor
   * instead of executing synchronously.
   */
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  async?: boolean;

  /**
   * Optional explicit routing path for multi-leg swaps.
   * e.g. ['USDT', 'ETH', 'BTC'] routes USDT→ETH→BTC.
   * When omitted, the pricing service determines the optimal route.
   */
  @ApiPropertyOptional({ example: ['USDT', 'ETH', 'BTC'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  route?: string[];
}
