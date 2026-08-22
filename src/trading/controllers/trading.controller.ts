import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TradingService } from '../services/trading.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  createOrder(@Req() req, @Body() createOrderDto: CreateOrderDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.tradingService.createOrder(userId, createOrderDto);
  }
}
