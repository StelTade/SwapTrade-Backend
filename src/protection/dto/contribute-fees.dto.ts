import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FundTier } from '../enums/fund-tier.enum';

export class ContributeFeesDto {
  @IsString()
  tradeId: string;

  @IsNumber()
  @Min(0)
  feeAmount: number;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  tier?: FundTier;
}
