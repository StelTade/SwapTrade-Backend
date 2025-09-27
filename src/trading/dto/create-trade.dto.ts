import { IsNumber, IsString, IsEnum } from 'class-validator';
import { TradeType } from '../../common/enums/trade-type.enum';

export class CreateTradeDto {
  @IsNumber()
  userId: number;

  @IsString()
  asset: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  price: number;

  @IsEnum(TradeType)
  type: TradeType;
}
