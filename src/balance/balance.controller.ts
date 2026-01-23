import { Controller, Get, Param, Query, Post, Body, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':userId')
  async getUserBalances(@Param('userId') userId: string) {
    return this.balanceService.getUserBalances(userId);
  }

  @Get('history/:userId')
  @UseGuards(BalanceHistoryGuard)
  @HttpCode(HttpStatus.OK)
  async getBalanceHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: BalanceHistoryQueryDto,
  ) {
    return this.balanceService.getBalanceHistory(userId.toString(), query);
  }

  // NEW: Update user balance
  @Post('update')
  @HttpCode(HttpStatus.OK)
  async updateBalance(@Body() dto: UpdateBalanceDto) {
    const newBalance = await this.balanceService.updateUserBalance(dto);
    return { userId: dto.userId, assetId: dto.assetId, newBalance };
  }
}
