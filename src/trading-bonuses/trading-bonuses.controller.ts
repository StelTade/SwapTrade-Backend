import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { TradingBonusesService } from './trading-bonuses.service';
import { BonusQueryDto, CalculateBonusDto } from './dto/trading-bonus.dto';

@Controller('trading-bonuses')
export class TradingBonusesController {
  constructor(private readonly tradingBonusesService: TradingBonusesService) {}

  /**
   * Calculate/recalculate the monthly bonus for a specific user.
   * POST /trading-bonuses/calculate
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateBonus(@Body() dto: CalculateBonusDto) {
    return this.tradingBonusesService.calculateMonthlyBonus(dto.userId, dto.month);
  }

  /**
   * Process all pending payouts for a month (monthly cron trigger).
   * POST /trading-bonuses/payouts/:month
   */
  @Post('payouts/:month')
  @HttpCode(HttpStatus.OK)
  async processPayouts(@Param('month') month: string) {
    return this.tradingBonusesService.processMonthlyPayouts(month);
  }

  /**
   * Get bonus history for a specific user.
   * GET /trading-bonuses/user/:userId
   */
  @Get('user/:userId')
  async getUserBonusHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: BonusQueryDto,
  ) {
    return this.tradingBonusesService.getUserBonusHistory(userId, query);
  }

  /**
   * Admin: get summary stats for a month.
   * GET /trading-bonuses/summary/:month
   */
  @Get('summary/:month')
  async getBonusSummary(@Param('month') month: string) {
    return this.tradingBonusesService.getBonusSummary(month);
  }
}
