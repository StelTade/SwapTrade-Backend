import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TradingService } from '../services/trading.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('orders')
  @UseGuards(AuthGuard('jwt'))
  createOrder(@Req() req, @Body() createOrderDto: CreateOrderDto) {
    const userId = req.user.id;
    return this.tradingService.createOrder(userId, createOrderDto);
  }
}
