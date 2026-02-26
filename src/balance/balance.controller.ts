import { Controller, Get, Param, Post, Body, ParseIntPipe } from '@nestjs/common';
import { UserBalanceService } from './service/user-balance.service';
import { CurrencyService } from './service/currency.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('balances')
@Controller('balances')
export class BalanceController {
  constructor(
    private readonly userBalanceService: UserBalanceService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Get('currencies')
  @ApiOperation({ summary: 'List supported currencies' })
  async getCurrencies() {
    return this.currencyService.findAll();
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user balances' })
  async getUserBalances(@Param('userId', ParseIntPipe) userId: number) {
    return this.userBalanceService.getUserBalances(userId);
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert currency amount' })
  async convertCurrency(@Body() body: { amount: number; fromAssetId: number; toAssetId: number }) {
    return {
      amount: body.amount,
      fromAssetId: body.fromAssetId,
      toAssetId: body.toAssetId,
      result: await this.currencyService.convert(body.amount, body.fromAssetId, body.toAssetId),
    };
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw currency amount' })
  async withdraw(@Body() body: { userId: number; assetId: number; amount: number }) {
    return this.userBalanceService.withdraw(body.userId, body.assetId, body.amount);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit currency amount' })
  async deposit(@Body() body: { userId: number; assetId: number; amount: number }) {
    return this.userBalanceService.deposit(body.userId, body.assetId, body.amount);
  }
}
