import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { MetricsService } from './metrics.service';

@Controller('admin')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('metrics/json')
  async getMetricsJson() {
    return this.metricsService.getMetricsJson();
  }

  @Get('users')
  async searchUsers(
    @Query('search') search: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.searchUsers(search, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('orders')
  async getOrders(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getOrders(
      userId ? parseInt(userId, 10) : undefined,
      status,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('trades')
  async getTrades(
    @Query('userId') userId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getTrades(
      userId ? parseInt(userId, 10) : undefined,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(@Param('id') id: string, @Request() req: any) {
    return this.adminService.cancelOrder(id, req.user.id);
  }

  @Post('orders/:id/refund')
  @HttpCode(HttpStatus.OK)
  async refundOrder(@Param('id') id: string, @Request() req: any) {
    return this.adminService.refundOrder(id, req.user.id);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.getAuditLogs(parseInt(page, 10), parseInt(limit, 10));
  }
}
