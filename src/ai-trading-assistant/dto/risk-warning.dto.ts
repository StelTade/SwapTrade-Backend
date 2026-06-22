import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class RiskWarningDto {
  @IsString()
  userId: string;

  @IsString()
  asset: string;

  @IsString()
  tradeType: string;

  @IsNumber()
  @IsPositive()
  notionalValue: number;

  @IsNumber()
  @Min(1)
  leverage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  portfolioAllocationPercent?: number;

  @IsOptional()
  @IsNumber()
  volatilityPercent?: number;
}
