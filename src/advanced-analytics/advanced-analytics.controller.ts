import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PortfolioPerformanceRequestDto } from './dto/portfolio-performance.dto';
import { BenchmarkComparisonRequestDto } from './dto/benchmark-comparison.dto';
import { TaxReportRequestDto } from './dto/tax-report.dto';
import { RebalancingRequestDto } from './dto/rebalancing.dto';

@ApiTags('advanced-analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AdvancedAnalyticsController {
  private readonly logger = new Logger(AdvancedAnalyticsController.name);

  constructor(private readonly advancedAnalyticsService: AdvancedAnalyticsService) {}

  @Get('risk-metrics/:userId')
  @ApiOperation({ summary: 'Get advanced risk metrics for a user portfolio' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Risk metrics retrieved successfully' })
  async getRiskMetrics(@Param('userId') userId: string, @CurrentUser() user: any) {
    if (user.id !== userId && !user.roles?.includes('admin')) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.advancedAnalyticsService.getAdvancedRiskMetrics(userId);
  }

  @Post('portfolio-performance')
  @ApiOperation({ summary: 'Calculate comprehensive portfolio performance metrics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Performance metrics calculated successfully' })
  async calculatePortfolioPerformance(@Body() dto: PortfolioPerformanceRequestDto) {
    const trades = dto.trades.map(t => ({
      ...t,
      date: new Date(t.date),
    }));

    const historicalPrices = new Map<string, any[]>();
    for (const [asset, prices] of Object.entries(dto.historicalPrices)) {
      historicalPrices.set(
        asset,
        prices.map(p => ({ ...p, date: new Date(p.date) }))
      );
    }

    return this.advancedAnalyticsService.getPortfolioPerformance(trades, historicalPrices);
  }

  @Post('benchmark-comparison')
  @ApiOperation({ summary: 'Compare portfolio performance against market benchmarks' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Benchmark comparison completed successfully' })
  async compareToBenchmarks(@Body() dto: BenchmarkComparisonRequestDto) {
    const benchmarkPrices = new Map<string, number[]>();
    for (const [benchmark, prices] of Object.entries(dto.benchmarkPrices)) {
      benchmarkPrices.set(benchmark, prices);
    }
    return this.advancedAnalyticsService.getBenchmarkComparison(dto.portfolioReturns, benchmarkPrices);
  }

  @Post('tax-report')
  @ApiOperation({ summary: 'Generate tax report for specified time period' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax report generated successfully' })
  async generateTaxReport(@Body() dto: TaxReportRequestDto) {
    const trades = dto.trades.map(t => ({
      ...t,
      date: new Date(t.date),
    }));
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    return this.advancedAnalyticsService.generateTaxReport(trades, startDate, endDate);
  }

  @Post('rebalancing-recommendations')
  @ApiOperation({ summary: 'Get AI-driven portfolio rebalancing recommendations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rebalancing recommendations generated successfully' })
  async getRebalancingRecommendations(@Body() dto: RebalancingRequestDto) {
    const assetVolatilities = new Map<string, number>();
    for (const [asset, volatility] of Object.entries(dto.assetVolatilities)) {
      assetVolatilities.set(asset, volatility);
    }
    return this.advancedAnalyticsService.getRebalancingRecommendations(
      dto.currentAllocation,
      dto.totalPortfolioValue,
      dto.riskTolerance,
      assetVolatilities
    );
  }

  @Get('portfolio-optimization/:userId')
  @ApiOperation({ summary: 'Get portfolio optimization suggestions' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Optimization suggestions retrieved successfully' })
  async getPortfolioOptimization(@Param('userId') userId: string, @CurrentUser() user: any) {
    if (user.id !== userId && !user.roles?.includes('admin')) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.advancedAnalyticsService.getPortfolioOptimization(userId);
  }

  @Get('export/:userId')
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: true })
  @ApiOperation({ summary: 'Export user analytics data' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics exported successfully' })
  async exportAnalytics(
    @Param('userId') userId: string,
    @Query('format') format: 'csv' | 'xlsx',
    @CurrentUser() user: any
  ) {
    if (user.id !== userId && !user.roles?.includes('admin')) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.advancedAnalyticsService.exportUserAnalytics(userId, format);
  }

  @Post('export-tax-report')
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: true })
  @ApiOperation({ summary: 'Export tax report as CSV or Excel' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax report exported successfully' })
  async exportTaxReport(
    @Body() dto: TaxReportRequestDto,
    @Query('format') format: 'csv' | 'xlsx'
  ) {
    const trades = dto.trades.map(t => ({
      ...t,
      date: new Date(t.date),
    }));
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    return this.advancedAnalyticsService.exportTaxReport(trades, startDate, endDate, format);
  }
}