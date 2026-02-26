import { IsNumber, IsPositive, IsString, MinLength, MaxLength, IsIn } from 'class-validator';
import { IsUserId, IsAssetType } from '../../common/validation';

export class CreateBidDto {
  @IsUserId()
  userId: number;

  @IsAssetType()
  asset: string;

  @IsString()
  @IsIn(['pending', 'active', 'completed', 'cancelled', 'failed'])
  @MinLength(1)
  @MaxLength(20)
  status: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  assetId: string;

  @IsNumber()
  @IsPositive({ message: 'Bid amount must be greater than zero' })
  amount: number;

  @IsNumber()
  @IsPositive({ message: 'Bid price must be greater than zero' })
  price: number;
}
