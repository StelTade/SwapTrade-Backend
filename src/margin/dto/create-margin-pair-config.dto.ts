import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateMarginPairConfigDto {
  @IsInt()
  baseAssetId: number;

  @IsInt()
  quoteAssetId: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxLeverage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialMarginRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceMarginRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyInterestRateBps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volatilityPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volatilityLeverageFactor?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  marginCallThresholdRatio?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
