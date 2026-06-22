import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InsuranceFundService } from './services/insurance-fund.service';
import { FundHealthService } from './services/fund-health.service';
import { LiquidationProtectionService } from './services/liquidation-protection.service';
import { InsuranceFeeContributionService } from './services/insurance-fee-contribution.service';
import { ReplenishFundDto } from './dto/replenish-fund.dto';
import { CoverShortfallDto } from './dto/cover-shortfall.dto';
import { ContributeFeesDto } from './dto/contribute-fees.dto';

@Controller('protection/insurance')
export class InsuranceFundController {
  constructor(
    private readonly insuranceFundService: InsuranceFundService,
    private readonly fundHealthService: FundHealthService,
    private readonly liquidationProtection: LiquidationProtectionService,
    private readonly feeContribution: InsuranceFeeContributionService,
  ) {}

  @Post('initialize')
  initializeFunds(@Query('asset') asset?: string) {
    return this.insuranceFundService.initializeFunds(asset ?? 'USDT');
  }

  @Get('funds')
  listFunds() {
    return this.insuranceFundService.listFunds();
  }

  @Get('funds/:id')
  getFund(@Param('id', ParseIntPipe) id: number) {
    return this.insuranceFundService.getFund(id);
  }

  @Get('tiers')
  listTiers() {
    return this.insuranceFundService.listTiers();
  }

  @Get('health/dashboard')
  getHealthDashboard() {
    return this.fundHealthService.getDashboard();
  }

  @Get('health/alerts')
  getHealthAlerts() {
    return this.fundHealthService.getActiveAlerts();
  }

  @Get('health/funds/:id')
  getFundHealth(@Param('id', ParseIntPipe) id: number) {
    return this.fundHealthService.getFundMetrics(id);
  }

  @Post('replenish')
  replenishFund(@Body() dto: ReplenishFundDto) {
    return this.insuranceFundService.replenishFund(
      dto.fundId,
      dto.amount,
      dto.referenceId,
      dto.description,
    );
  }

  @Post('cover-shortfall')
  coverShortfall(@Body() dto: CoverShortfallDto) {
    return this.liquidationProtection.coverShortfall(
      dto.userId,
      dto.shortfallAmount,
      dto.positionId,
      dto.asset ?? 'USDT',
      dto.tier,
    );
  }

  @Post('contribute-fees')
  contributeFees(@Body() dto: ContributeFeesDto) {
    return this.feeContribution.contributeFromTradeFee(
      dto.tradeId,
      dto.feeAmount,
      dto.asset ?? 'USDT',
      dto.tier,
    );
  }

  @Get('transactions')
  getTransactions(
    @Query('fundId') fundId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.insuranceFundService.getTransactionHistory(
      fundId ? parseInt(fundId, 10) : undefined,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
