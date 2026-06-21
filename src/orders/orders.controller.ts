import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';
import { OrderStatus } from '../common/enums/order-type.enum';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  placeOrder(@Body() dto: CreateOrderDto, @Req() req: { user: JwtPayload }) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.placeOrder(userId, dto);
  }

  @Patch(':orderId')
  modifyOrder(
    @Param('orderId') orderId: string,
    @Body() dto: Omit<ModifyOrderDto, 'orderId'>,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.modifyOrder(userId, { ...dto, orderId });
  }

  @Patch(':orderId/cancel')
  cancelOrder(
    @Param('orderId') orderId: string,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.cancelOrder(userId, orderId);
  }

  @Get(':orderId')
  getOrder(
    @Param('orderId') orderId: string,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.getOrder(userId, orderId);
  }

  @Get()
  getUserOrders(
    @Query('status') status: OrderStatus | undefined,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.getUserOrders(userId, status);
  }
}
