import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsInt,
  ValidateIf,
  Min,
} from 'class-validator';
import { OrderSide, OrderType } from '../../common/enums/order-type.enum';

export class CreateOrderDto {
  @IsInt()
  assetId: number;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType;

  @IsNumber()
  @IsPositive()
  amount: number;

  /** Required for LIMIT orders. Ignored for MARKET. */
  @ValidateIf((dto: CreateOrderDto) => dto.type === OrderType.LIMIT)
  @IsNumber()
  @IsPositive()
  price?: number;

  /** Required for STOP_LOSS / TAKE_PROFIT orders. */
  @ValidateIf(
    (dto: CreateOrderDto) =>
      dto.type === OrderType.STOP_LOSS || dto.type === OrderType.TAKE_PROFIT,
  )
  @IsNumber()
  @IsPositive()
  stopPrice?: number;

  /** Required for TRAILING_STOP orders. Percentage, e.g. 5 = 5%. */
  @ValidateIf((dto: CreateOrderDto) => dto.type === OrderType.TRAILING_STOP)
  @IsNumber()
  @Min(0.01)
  trailingDelta?: number;

  @IsOptional()
  @IsNumber()
  expiresInSeconds?: number;
}
