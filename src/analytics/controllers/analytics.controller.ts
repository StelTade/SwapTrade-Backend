import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioAnalyticsService } from '../services/portfolio-analytics.service';
import { 
  AnalyticsRequest, 
  AnalyticsResponse, 
  HistoricalPerformance, 
  RiskMetrics 
} from '../interfaces/analytics.interfaces';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: PortfolioAnalyticsService) {}

  @Post('portfolio')
  @ApiOperation({ summary: 'Get comprehensive portfolio analytics' })
  @ApiResponse({ status: 200, description: 'Portfolio analytics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPortfolioAnalytics(
    @Request() req: any,
    @Body() analyticsRequest: AnalyticsRequest
  ): Promise<AnalyticsResponse> {
    // Override userId with authenticated user's ID
    analyticsRequest.userId = req.user.id;
    
    return this.analyticsService.getPortfolioAnalytics(analyticsRequest);
  }

  @Get('portfolio/:userId')
  @ApiOperation({ summary: 'Get portfolio analytics for specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period' })
  @ApiQuery({ name: 'benchmark', required: false, description: 'Benchmark for comparison' })
  @ApiResponse({ status: 200, description: 'Portfolio analytics retrieved successfully' })
  async getUserPortfolioAnalytics(
    @Param('userId') userId: string,
    @Query('period') period?: string,
    @Query('benchmark') benchmark?: string
  ): Promise<AnalyticsResponse> {
    const request: AnalyticsRequest = {
      userId,
      period,
      benchmark,
      includeRecommendations: true,
      includeHistorical: true,
      includeRiskMetrics: true
    };

    return this.analyticsService.getPortfolioAnalytics(request);
  }

  @Get('performance/:userId')
  @ApiOperation({ summary: 'Get historical performance data' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (1D, 1W, 1M, 3M, 6M, 1Y)', enum: ['1D', '1W', '1M', '3M', '6M', '1Y'] })
  @ApiResponse({ status: 200, description: 'Historical performance data retrieved successfully' })
  async getHistoricalPerformance(
    @Param('userId') userId: string,
    @Query('period') period: string = '1M'
  ): Promise<HistoricalPerformance> {
    return this.analyticsService.getHistoricalPerformance(userId, period);
  }

  @Get('risk/:userId')
  @ApiOperation({ summary: 'Get detailed risk metrics' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Risk metrics retrieved successfully' })
  async getRiskMetrics(
    @Param('userId') userId: string
  ): Promise<RiskMetrics> {
    return this.analyticsService.getRiskMetrics(userId);
  }

  @Get('summary/:userId')
  @ApiOperation({ summary: 'Get portfolio summary with key metrics' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Portfolio summary retrieved successfully' })
  async getPortfolioSummary(
    @Param('userId') userId: string
  ) {
    const request: AnalyticsRequest = {
      userId,
      includeRecommendations: false,
      includeHistorical: false,
      includeRiskMetrics: false
    };

    const response = await this.analyticsService.getPortfolioAnalytics(request);
    
    if (!response.success || !response.data) {
      return response;
    }

    // Return only key summary metrics
    const { data } = response;
    return {
      success: true,
      data: {
        totalValue: data.totalValue,
        totalValueChange24h: data.totalValueChange24h,
        totalValueChange7d: data.totalValueChange7d,
        totalValueChange30d: data.totalValueChange30d,
        riskScore: {
          overall: data.riskScore.overall,
          level: data.riskScore.level
        },
        diversification: {
          score: data.diversification.score,
          assetCount: data.diversification.assetCount
        },
        performance: {
          totalReturn: data.performance.totalReturn,
          sharpeRatio: data.performance.sharpeRatio,
          maxDrawdown: data.performance.maxDrawdown,
          winRate: data.performance.winRate
        },
        topAssets: data.allocation.slice(0, 5).map(asset => ({
          asset: asset.asset,
          value: asset.value,
          percentage: asset.percentage,
          change24h: asset.change24h
        }))
      },
      timestamp: response.timestamp,
      processingTime: response.processingTime
    };
  }

  @Get('recommendations/:userId')
  @ApiOperation({ summary: 'Get portfolio recommendations' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  async getRecommendations(
    @Param('userId') userId: string
  ) {
    const request: AnalyticsRequest = {
      userId,
      includeRecommendations: true,
      includeHistorical: false,
      includeRiskMetrics: false
    };

    const response = await this.analyticsService.getPortfolioAnalytics(request);
    
    if (!response.success || !response.data) {
      return response;
    }

    return {
      success: true,
      data: {
        recommendations: response.data.recommendations,
        riskLevel: response.data.riskScore.level,
        diversificationScore: response.data.diversification.score,
        lastUpdated: response.data.lastUpdated
      },
      timestamp: response.timestamp,
      processingTime: response.processingTime
    };
  }

  @Get('allocation/:userId')
  @ApiOperation({ summary: 'Get detailed asset allocation' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Asset allocation retrieved successfully' })
  async getAssetAllocation(
    @Param('userId') userId: string
  ) {
    const request: AnalyticsRequest = {
      userId,
      includeRecommendations: false,
      includeHistorical: false,
      includeRiskMetrics: false
    };

    const response = await this.analyticsService.getPortfolioAnalytics(request);
    
    if (!response.success || !response.data) {
      return response;
    }

    return {
      success: true,
      data: {
        totalValue: response.data.totalValue,
        allocation: response.data.allocation,
        sectorAllocation: response.data.diversification.sectorAllocation,
        geographicAllocation: response.data.diversification.geographicAllocation,
        concentrationRatio: response.data.diversification.concentrationRatio,
        effectiveAssets: response.data.diversification.effectiveAssets,
        lastUpdated: response.data.lastUpdated
      },
      timestamp: response.timestamp,
      processingTime: response.processingTime
    };
  }

  @Get('comparison/:userId')
  @ApiOperation({ summary: 'Compare portfolio with benchmark' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'benchmark', required: false, description: 'Benchmark symbol' })
  @ApiQuery({ name: 'period', required: false, description: 'Comparison period' })
  @ApiResponse({ status: 200, description: 'Benchmark comparison completed successfully' })
  async getBenchmarkComparison(
    @Param('userId') userId: string,
    @Query('benchmark') benchmark?: string,
    @Query('period') period?: string
  ) {
    const historicalData = await this.analyticsService.getHistoricalPerformance(userId, period || '1M');
    
    return {
      success: true,
      data: {
        period: historicalData.period,
        portfolio: {
          totalReturn: historicalData.metrics.totalReturn,
          annualizedReturn: historicalData.metrics.annualizedReturn,
          volatility: historicalData.metrics.volatility,
          sharpeRatio: historicalData.metrics.sharpeRatio,
          maxDrawdown: historicalData.metrics.maxDrawdown
        },
        benchmark: historicalData.benchmark,
        performance: {
          alpha: historicalData.benchmark.alpha,
          beta: historicalData.benchmark.beta,
          informationRatio: historicalData.benchmark.informationRatio,
          trackingError: historicalData.benchmark.trackingError,
          upCapture: historicalData.benchmark.upCapture,
          downCapture: historicalData.benchmark.downCapture
        },
        dataPoints: historicalData.data.slice(-30) // Last 30 data points
      },
      timestamp: new Date().toISOString()
    };
  }

  @Get('risk-analysis/:userId')
  @ApiOperation({ summary: 'Get comprehensive risk analysis' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'timeHorizon', required: false, description: 'Risk calculation time horizon' })
  @ApiQuery({ name: 'confidence', required: false, description: 'Confidence level for VaR/ES' })
  @ApiResponse({ status: 200, description: 'Risk analysis completed successfully' })
  async getRiskAnalysis(
    @Param('userId') userId: string,
    @Query('timeHorizon') timeHorizon?: string,
    @Query('confidence') confidence?: number
  ) {
    const riskMetrics = await this.analyticsService.getRiskMetrics(userId);
    
    return {
      success: true,
      data: {
        riskScore: {
          overall: 0, // Would be calculated from portfolio analytics
          level: 'MODERATE',
          factors: []
        },
        valueAtRisk: riskMetrics.valueAtRisk,
        expectedShortfall: riskMetrics.expectedShortfall,
        stressTest: riskMetrics.stressTest,
        scenarioAnalysis: riskMetrics.scenarioAnalysis,
        correlationAnalysis: {
          systematicRisk: riskMetrics.correlationMatrix.systematicRisk,
          unsystematicRisk: riskMetrics.correlationMatrix.unsystematicRisk,
          effectiveAssets: riskMetrics.correlationMatrix.eigenvalues.filter(e => e > 0.1).length
        },
        recommendations: this.generateRiskRecommendations(riskMetrics),
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }

  private generateRiskRecommendations(riskMetrics: RiskMetrics): any[] {
    const recommendations = [];

    // VaR-based recommendations
    if (riskMetrics.valueAtRisk.var1Day > 5000) {
      recommendations.push({
        type: 'RISK_REDUCE',
        priority: 'HIGH',
        title: 'High Value at Risk Detected',
        description: `Your 1-day VaR is $${riskMetrics.valueAtRisk.var1Day.toFixed(2)}`,
        action: 'Consider reducing position sizes or adding hedges',
        expectedImpact: 'Reduce potential losses by 20-30%'
      });
    }

    // Stress test recommendations
    if (riskMetrics.stressTest.maxLoss > 0.25) {
      recommendations.push({
        type: 'RISK_REDUCE',
        priority: 'MEDIUM',
        title: 'High Stress Test Loss',
        description: `Stress testing shows potential loss of ${(riskMetrics.stressTest.maxLoss * 100).toFixed(1)}%`,
        action: 'Diversify portfolio and consider defensive assets',
        expectedImpact: 'Improve resilience during market stress'
      });
    }

    return recommendations;
  }
}
