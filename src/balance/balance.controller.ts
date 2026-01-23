import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceHistoryQueryDto } from './dto/balance-history.dto';
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
}
