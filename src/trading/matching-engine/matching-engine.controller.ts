import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdvancedMatchingService } from './advanced-matching.service';
import { OrderSide, OrderType, TimeInForce } from './types/order.types';

export class SubmitOrderDto {
  userId: string;
  asset: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: TimeInForce;
}

@Controller('matching-engine')
export class MatchingEngineController {
  constructor(private readonly matchingService: AdvancedMatchingService) {}

  @Post('orders')
  async submitOrder(@Body() dto: SubmitOrderDto) {
    const result = await this.matchingService.submitOrder(
      dto.userId,
      dto.asset,
      dto.side,
      dto.type,
      dto.quantity,
      dto.price,
      dto.stopPrice,
      dto.timeInForce || TimeInForce.GTC,
    );

    return {
      success: true,
      order: {
        id: result.order.id,
        status: result.order.status,
        filledQuantity: result.order.filledQuantity,
        remainingQuantity: result.order.remainingQuantity,
      },
      matches: result.matches.map(m => ({
        price: m.price,
        quantity: m.quantity,
        timestamp: m.timestamp,
        buyerFee: m.buyerFee,
        sellerFee: m.sellerFee,
      })),
    };
  }

  @Delete('orders/:orderId')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Query('userId') userId: string,
  ) {
    const cancelled = await this.matchingService.cancelOrder(userId, orderId);

    return {
      success: cancelled,
      message: cancelled ? 'Order cancelled successfully' : 'Order not found or already filled',
    };
  }

  @Get('orderbook/:asset')
  async getOrderBook(
    @Param('asset') asset: string,
    @Query('levels') levels?: string,
  ) {
    const depth = await this.matchingService.getOrderBookDepth(
      asset,
      levels ? parseInt(levels) : 10,
    );

    return {
      asset,
      bids: depth.bids.map(([price, quantity]) => ({ price, quantity })),
      asks: depth.asks.map(([price, quantity]) => ({ price, quantity })),
      timestamp: new Date(),
    };
  }

  @Get('stats/:asset')
  async getStats(@Param('asset') asset: string) {
    const stats = this.matchingService.getMatchingStats(asset);

    return {
      asset,
      stats: stats || {
        ordersProcessed: 0,
        matchesExecuted: 0,
        totalVolume: 0,
        averageMatchTime: 0,
        queueDepth: 0,
        rejectedOrders: 0,
      },
    };
  }

  @Get('worker-pool/stats')
  async getWorkerPoolStats() {
    return this.matchingService.getWorkerPoolStats();
  }
}
