import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  OrderGqlType,
  CreateOrderInput,
  ModifyOrderInput,
} from './dto/orders-graphql.types';
import { OrderStatus } from '../common/enums/order-type.enum';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { CurrentGqlUser } from './decorators/current-gql-user.decorator';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';

@Resolver(() => OrderGqlType)
@UseGuards(GqlJwtAuthGuard)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Mutation(() => OrderGqlType)
  placeOrder(
    @Args('input') input: CreateOrderInput,
    @CurrentGqlUser() user: JwtPayload,
  ) {
    const userId = parseInt(user.userId, 10);
    return this.ordersService.placeOrder(userId, input);
  }

  @Mutation(() => OrderGqlType)
  modifyOrder(
    @Args('input') input: ModifyOrderInput,
    @CurrentGqlUser() user: JwtPayload,
  ) {
    const userId = parseInt(user.userId, 10);
    return this.ordersService.modifyOrder(userId, input);
  }

  @Mutation(() => OrderGqlType)
  cancelOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentGqlUser() user: JwtPayload,
  ) {
    const userId = parseInt(user.userId, 10);
    return this.ordersService.cancelOrder(userId, orderId);
  }

  @Query(() => OrderGqlType)
  order(
    @Args('orderId', { type: () => ID }) orderId: string,
    @CurrentGqlUser() user: JwtPayload,
  ) {
    const userId = parseInt(user.userId, 10);
    return this.ordersService.getOrder(userId, orderId);
  }

  @Query(() => [OrderGqlType])
  userOrders(
    @CurrentGqlUser() user: JwtPayload,
    @Args('status', { type: () => OrderStatus, nullable: true })
    status?: OrderStatus,
  ) {
    const userId = parseInt(user.userId, 10);
    return this.ordersService.getUserOrders(userId, status);
  }
}
