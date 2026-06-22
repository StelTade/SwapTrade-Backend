import {
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Single trade instruction within a bulk trade request.
 */
export class BulkTradeItemDto {
  @IsInt()
  assetId: number;

  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsEnum(['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'])
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';

  @IsNumber()
  @IsPositive()
  amount: number;

  /** Required for LIMIT orders */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  /** Required for STOP_LOSS / TAKE_PROFIT */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopPrice?: number;

  /** Optional client-assigned ID for idempotency */
  @IsOptional()
  @IsInt()
  clientOrderId?: number;
}

/**
 * DTO for submitting a batch of trades.
 * Supports up to 500 trades per request for high-frequency trading.
 */
export class BulkTradeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkTradeItemDto)
  trades: BulkTradeItemDto[];

  /** If true, all-or-nothing: rollback all trades on any failure */
  @IsOptional()
  atomic?: boolean;

  /** Optional idempotency key for the entire batch */
  @IsOptional()
  @IsInt()
  idempotencyKey?: string;
}
