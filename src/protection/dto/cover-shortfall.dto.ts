import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FundTier } from '../enums/fund-tier.enum';

export class CoverShortfallDto {
  @IsInt()
  userId: number;

  @IsNumber()
  @Min(0)
  shortfallAmount: number;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  tier?: FundTier;
}
