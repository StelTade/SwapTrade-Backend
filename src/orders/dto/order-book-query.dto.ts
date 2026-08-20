import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderBookQueryDto {
  /**
   * Number of price levels to return per side (bids/asks).
   * Defaults to 10, max 100.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  depth?: number = 10;
}
