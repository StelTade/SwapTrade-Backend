import { IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { OrderType } from '../../common/enums/order-type.enum';

export class CreateOrderDto {
	@IsNumber()
	userId: number;

	@IsString()
	asset: string;

	@IsEnum(OrderType)
	type: OrderType;

	@IsNumber()
	@Min(0.00000001)
	amount: number;

	@IsNumber()
	@Min(0.01)
	price: number;
}
