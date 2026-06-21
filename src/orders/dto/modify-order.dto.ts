import { IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class ModifyOrderDto {
  @IsUUID()
  orderId: string;

  /** New limit price. Only valid for resting LIMIT orders. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  /** New total order amount. Must be >= already-filled amount. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  /** New stop trigger price (STOP_LOSS / TAKE_PROFIT). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  stopPrice?: number;

  /** New trailing delta percentage (TRAILING_STOP). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  trailingDelta?: number;
}
