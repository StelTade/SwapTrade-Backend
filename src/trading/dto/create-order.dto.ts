import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { OrderType, OrderSide } from '../enums/order.enum';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  assetPair: string;

  @IsNotEmpty()
  @IsEnum(OrderSide)
  side: OrderSide;

  @IsNotEmpty()
  @IsEnum(OrderType)
  type: OrderType;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;
}
