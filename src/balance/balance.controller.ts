import { Controller, Get, Param, Post, Body, ParseIntPipe, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UserBalanceService } from './service/user-balance.service';
import { CurrencyService } from './service/currency.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateBalanceDto } from './dto/update-balance.dto';
// import { BalanceHistoryQueryDto, BalanceHistoryResponseDto } from './dto/balance-history.dto';
// import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
// import { ApiBalanceErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

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
  @ApiOperation({ summary: 'Get user balances', description: 'Returns all balances for a user.' })
  @ApiResponse({ status: 200, description: 'User balances retrieved' })
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

  // Merged from main: Update user balance
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user balance', description: 'Updates the balance for a user.' })
  @ApiResponse({ status: 200, description: 'Balance updated' })
  async updateBalance(@Body() dto: UpdateBalanceDto) {
    // Map to deposit/withdraw based on amount sign
    if (dto.amount > 0) {
      return this.userBalanceService.deposit(dto.userId, dto.assetId, dto.amount);
    } else {
      return this.userBalanceService.withdraw(dto.userId, dto.assetId, Math.abs(dto.amount));
    }
  }

  /* TODO: Port Balance History to UserBalanceService
  @Get('history/:userId')
  @UseGuards(BalanceHistoryGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user balance history' })
  @ApiResponse({ status: 200, description: 'Balance history retrieved', type: BalanceHistoryResponseDto })
  async getBalanceHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: BalanceHistoryQueryDto,
  ) {
    // return this.userBalanceService.getBalanceHistory(userId, query);
    throw new Error('Not implemented');
  }
  */
}
