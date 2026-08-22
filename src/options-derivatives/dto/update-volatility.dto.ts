import { IsInt, IsPositive, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateVolatilityDto {
  @IsInt()
  @IsPositive()
  assetId: number;

  @IsNumber()
  @IsPositive()
  strikePrice: number;

  /** ISO date string for expiration. */
  expirationDate: string;

  @IsNumber()
  @Min(0.01)
  @Max(10)
  impliedVolatility: number;

  @IsOptional()
  @IsNumber()
  bidIv?: number;

  @IsOptional()
  @IsNumber()
  askIv?: number;

  @IsOptional()
  @IsNumber()
  lastTradedIv?: number;
}
