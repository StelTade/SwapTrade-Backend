import {
  ObjectType,
  Field,
  InputType,
  Float,
  Int,
  ID,
  registerEnumType,
} from '@nestjs/graphql';
import {
  OrderSide,
  OrderType,
  OrderStatus,
} from '../../common/enums/order-type.enum';

registerEnumType(OrderSide, { name: 'OrderSide' });
registerEnumType(OrderType, { name: 'OrderType' });
registerEnumType(OrderStatus, { name: 'OrderStatus' });

@ObjectType('Order')
export class OrderGqlType {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  userId: number;

  @Field(() => Int)
  assetId: number;

  @Field(() => OrderSide)
  side: OrderSide;

  @Field(() => OrderType)
  type: OrderType;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => Float)
  amount: number;

  @Field(() => Float)
  filledAmount: number;

  @Field(() => Float, { nullable: true })
  averageFillPrice: number | null;

  @Field(() => Float, { nullable: true })
  price: number | null;

  @Field(() => Float, { nullable: true })
  stopPrice: number | null;

  @Field(() => Float, { nullable: true })
  trailingDelta: number | null;

  @Field(() => Float, { nullable: true })
  trailingReferencePrice: number | null;

  @Field(() => Date, { nullable: true })
  triggeredAt: Date | null;

  @Field(() => Date, { nullable: true })
  filledAt: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt: Date | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType()
export class CreateOrderInput {
  @Field(() => Int)
  assetId: number;

  @Field(() => OrderSide)
  side: OrderSide;

  @Field(() => OrderType)
  type: OrderType;

  @Field(() => Float)
  amount: number;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  stopPrice?: number;

  @Field(() => Float, { nullable: true })
  trailingDelta?: number;

  @Field(() => Int, { nullable: true })
  expiresInSeconds?: number;
}

@InputType()
export class ModifyOrderInput {
  @Field(() => ID)
  orderId: string;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => Float, { nullable: true })
  stopPrice?: number;

  @Field(() => Float, { nullable: true })
  trailingDelta?: number;
}
