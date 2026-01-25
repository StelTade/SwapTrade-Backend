import { IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { TradeType } from '../../common/enums/trade-type.enum';
import { IsUserId, IsAssetType } from '../../common/validation';

export class CreateTradeDto {
  @IsUserId()
  userId: number;

  @IsAssetType()
  asset: string;

  @IsNumber()
  @Min(0.00000001)
  amount: number;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsEnum(TradeType)
  type: TradeType;
}
