import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { LiquidityPoolService } from './services/liquidity-pool.service';
import { PoolAnalyticsService } from './services/pool-analytics.service';
import { CreatePoolDto } from './dto/create-pool.dto';
import { AddLiquidityDto } from './dto/add-liquidity.dto';
import { RemoveLiquidityDto } from './dto/remove-liquidity.dto';
import { SwapDto } from './dto/swap.dto';
import { EmergencyWithdrawDto } from './dto/emergency-withdraw.dto';

@Controller('exchange/pools')
export class LiquidityPoolController {
  constructor(
    private readonly poolService: LiquidityPoolService,
    private readonly analyticsService: PoolAnalyticsService,
  ) {}

  @Post()
  createPool(@Body() dto: CreatePoolDto) {
    return this.poolService.createPool(dto);
  }

  @Get()
  listPools(@Query('chainId') chainId?: string) {
    return this.poolService.listPools(chainId);
  }

  @Get('analytics/dashboard')
  getAnalyticsDashboard() {
    return this.analyticsService.getAnalyticsDashboard();
  }

  @Get(':id')
  getPool(@Param('id', ParseIntPipe) id: number) {
    return this.poolService.getPool(id);
  }

  @Get(':id/metrics')
  getPoolMetrics(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getPoolMetrics(id);
  }

  @Post(':id/liquidity/add')
  addLiquidity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddLiquidityDto,
  ) {
    return this.poolService.addLiquidity(id, dto);
  }

  @Post(':id/liquidity/remove')
  removeLiquidity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RemoveLiquidityDto,
  ) {
    return this.poolService.removeLiquidity(id, dto);
  }

  @Post(':id/swap')
  swap(@Param('id', ParseIntPipe) id: number, @Body() dto: SwapDto) {
    return this.poolService.swap(id, dto);
  }

  @Get(':id/quote')
  quoteSwap(
    @Param('id', ParseIntPipe) id: number,
    @Query('tokenIn') tokenIn: string,
    @Query('amountIn') amountIn: string,
  ) {
    return this.poolService.quoteSwap(id, tokenIn, parseFloat(amountIn));
  }

  @Post(':id/emergency-withdraw')
  emergencyWithdraw(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EmergencyWithdrawDto,
  ) {
    return this.poolService.emergencyWithdraw(id, dto);
  }
}

@Controller('exchange/positions')
export class PoolPositionController {
  constructor(
    private readonly poolService: LiquidityPoolService,
    private readonly analyticsService: PoolAnalyticsService,
  ) {}

  @Get('user/:userId')
  getUserPositions(@Param('userId', ParseIntPipe) userId: number) {
    return this.poolService.getUserPositions(userId);
  }

  @Get(':id/impermanent-loss')
  getImpermanentLoss(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getImpermanentLoss(id);
  }
}
