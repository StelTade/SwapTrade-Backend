import { IsNumber, IsString, Min } from 'class-validator';
import { IsUserId, IsAssetType } from '../../common/validation';

export class UpdatePortfolioDto {
  @IsUserId()
  userId: number;

  @IsAssetType()
  asset: string;

  @IsNumber()
  @Min(0)
  balance: number;
}
