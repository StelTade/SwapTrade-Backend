import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { TradingService } from './trading.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderType } from '../common/enums/order-type.enum';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('swap')
  async swap(@Body() createTradeDto: CreateTradeDto) {
    return this.tradingService.swap(
      createTradeDto.userId,
      createTradeDto.asset,
      createTradeDto.amount,
      createTradeDto.price,
      createTradeDto.type,
    );
  }

  @Post('order')
  async placeOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.tradingService.placeOrder(
      createOrderDto.userId,
      createOrderDto.asset,
      createOrderDto.type,
      createOrderDto.amount,
      createOrderDto.price,
    );
  }

  @Get('order-book/:asset')
  async getOrderBook(@Param('asset') asset: string) {
    return this.tradingService.getOrderBook(asset);
  }

  @Post('order/:orderId/cancel/:userId')
  async cancelOrder(
    @Param('orderId') orderId: number,
    @Param('userId') userId: number,
  ) {
    return this.tradingService.cancelOrder(orderId, userId);
  }

  @Post('order/:orderId/execute')
  async executeOrder(@Param('orderId') orderId: number) {
    return this.tradingService.executeOrder(orderId);
  }
}
