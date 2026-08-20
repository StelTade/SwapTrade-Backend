import {
  Body,
  Controller,
  Delete,
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
import { OrderBookService } from './services/order-book.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';
import { OrderBookQueryDto } from './dto/order-book-query.dto';
import { PaginatedOrdersQueryDto } from './dto/paginated-orders.dto';
import { DataSource } from 'typeorm';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderBookService: OrderBookService,
    private readonly dataSource: DataSource,
  ) {}

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

  /**
   * DELETE /orders/:id — cancels an open order and frees reserved funds.
   * Acceptance criteria: cancelled orders are persisted with status.
   */
  @Delete(':id')
  deleteOrder(
    @Param('id') id: string,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.cancelOrder(userId, id);
  }

  @Get(':orderId')
  getOrder(
    @Param('orderId') orderId: string,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.getOrder(userId, orderId);
  }

  /**
   * GET /orders — returns user orders with pagination and optional status filter.
   */
  @Get()
  getUserOrders(
    @Query() query: PaginatedOrdersQueryDto,
    @Req() req: { user: JwtPayload },
  ) {
    const userId = parseInt(req.user.userId, 10);
    return this.ordersService.getUserOrdersPaginated(
      userId,
      query.page,
      query.limit,
      query.status,
    );
  }
}

/**
 * Public (unauthenticated) order book controller.
 * Serves GET /orderbook/:pair for market data consumers.
 */
@Controller('orderbook')
export class OrderBookController {
  constructor(
    private readonly orderBookService: OrderBookService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * GET /orderbook/:pair — returns aggregated top-of-book (best bid/ask)
   * and depth (configurable levels via ?depth=N query param, default 10, max 100).
   *
   * The :pair parameter accepts either a numeric asset ID or a virtual asset
   * symbol (e.g. "BTC" or "ETH"). The symbol is resolved to the asset ID.
   */
  @Get(':pair')
  async getOrderBook(
    @Param('pair') pair: string,
    @Query() query: OrderBookQueryDto,
  ) {
    const assetId = await this.resolvePair(pair);
    return this.orderBookService.getOrderBookResponse(assetId, query.depth);
  }

  private async resolvePair(pair: string): Promise<number> {
    // Try parsing as numeric ID first
    const numericId = parseInt(pair, 10);
    if (!isNaN(numericId)) {
      return numericId;
    }

    // Try resolving by symbol
    const asset = await this.dataSource
      .getRepository(VirtualAsset)
      .findOne({ where: { symbol: pair.toUpperCase() } });

    if (!asset) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException(`Asset pair '${pair}' not found`);
    }

    return asset.id;
  }
}
