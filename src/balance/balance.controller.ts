
import { Controller, Get, Param, Query, Post, Body, UseGuards, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceHistoryQueryDto, BalanceHistoryResponseDto } from './dto/balance-history.dto';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { PaginationQueryDto } from '../common/interfaces/pagination.dto';
import { BalanceHistoryGuard } from '../common/guards/balance-history.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiBalanceErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('balance')
@ApiBearerAuth()
@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}


  @Get(':userId')
  @ApiOperation({ summary: 'Get user balances', description: 'Returns all balances for a user. Requires authentication. Rate limited to 50 requests per minute.' })
  @ApiResponse({ status: 200, description: 'User balances retrieved', schema: { example: [{ asset: 'BTC', balance: 1.5 }] } })
  @ApiBalanceErrorResponses()
  async getUserBalances(
    @Param('userId') userId: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    return this.balanceService.getUserBalances(userId, pagination);
  }


  @Get('history/:userId')
  @UseGuards(BalanceHistoryGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user balance history', description: 'Returns paginated balance history for a user. Requires authentication. Rate limited.' })
  @ApiResponse({ status: 200, description: 'Balance history retrieved', type: BalanceHistoryResponseDto })
  @ApiBalanceErrorResponses()
  async getBalanceHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: BalanceHistoryQueryDto,
  ) {
    return this.balanceService.getBalanceHistory(userId.toString(), query);
  }


  // NEW: Update user balance
  @Post('update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user balance', description: 'Updates the balance for a user. Requires authentication. Rate limited.' })
  @ApiResponse({ status: 200, description: 'Balance updated', schema: { example: { userId: 123, assetId: 1, newBalance: 100.5 } } })
  @ApiBalanceErrorResponses()
  async updateBalance(@Body() dto: UpdateBalanceDto) {
    const newBalance = await this.balanceService.updateUserBalance(dto);
    return { userId: dto.userId, assetId: dto.assetId, newBalance };
  }
}
