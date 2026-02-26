import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  Request,
  Query,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PortfolioPerformanceDto } from './dto/portfolio-performance.dto';
import { PortfolioRiskDto } from './dto/portfolio-risk.dto';
import { PortfolioSummaryDto } from './dto/portfolio-summary.dto';

@ApiTags('portfolio')
@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards()
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post()
  @ApiOperation({ summary: 'Update portfolio' })
  @ApiResponse({ status: 201, description: 'Portfolio updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiBody({ type: UpdatePortfolioDto })
  updatePortfolio(@Body() updatePortfolioDto: UpdatePortfolioDto) {
    // Placeholder implementation
    return { message: 'Portfolio updated', data: updatePortfolioDto };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  getUserPortfolio(@Param('userId') userId: string) {
    // Placeholder implementation
    return { userId, assets: [] };
  }
  @Get('summary')
  @ApiOperation({
    summary: 'Get portfolio summary',
    description:
      'Returns total portfolio value, asset breakdown, and allocation percentages',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio summary retrieved successfully',
    type: PortfolioSummaryDto,
  })
  async getPortfolioSummary(@Request() req): Promise<PortfolioSummaryDto> {
    return this.portfolioService.getPortfolioSummary(req.user.userId);
  }

  @Get('risk')
  @ApiOperation({
    summary: 'Get portfolio risk metrics',
    description:
      'Returns concentration risk, diversification score, and volatility estimate',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio risk metrics retrieved successfully',
    type: PortfolioRiskDto,
  })
  async getPortfolioRisk(@Request() req): Promise<PortfolioRiskDto> {
    return this.portfolioService.getPortfolioRisk(req.user.userId);
  }

  @Get('performance')
  @ApiOperation({
    summary: 'Get portfolio performance',
    description:
      'Returns gain/loss, ROI, and performance metrics with optional date filtering',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date in ISO format (e.g., 2026-01-01T00:00:00Z)',
    example: '2026-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date in ISO format (e.g., 2026-01-22T23:59:59Z)',
    example: '2026-01-22T23:59:59Z',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio performance retrieved successfully',
    type: PortfolioPerformanceDto,
  })
  async getPortfolioPerformance(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PortfolioPerformanceDto> {
    return this.portfolioService.getPortfolioPerformance(
      req.user.userId,
      startDate,
      endDate,
    );
  }
}
