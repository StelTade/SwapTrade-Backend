import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';
import { MarketData } from '../trading/entities/market-data.entity';
import { SubscribePairsDto, MarketDataQueryDto } from './dto/market-data.dto';

@ApiTags('Market Data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get()
  @ApiOperation({ summary: 'Get current market data' })
  @ApiResponse({ status: 200, description: 'Market data retrieved successfully', type: [MarketData] })
  @ApiQuery({ name: 'symbol', required: false, description: 'Asset symbol (e.g., BTC, ETH)' })
  async getMarketData(@Query() query: MarketDataQueryDto): Promise<MarketData[]> {
    try {
      return await this.marketDataService.getMarketData(query.symbol);
    } catch (error) {
      throw new HttpException('Failed to fetch market data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('historical')
  @ApiOperation({ summary: 'Get historical market data' })
  @ApiResponse({ status: 200, description: 'Historical market data retrieved successfully', type: [MarketData] })
  @ApiQuery({ name: 'symbol', required: true, description: 'Asset symbol' })
  @ApiQuery({ name: 'fromDate', required: true, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'toDate', required: true, description: 'End date (ISO string)' })
  async getHistoricalData(
    @Query('symbol') symbol: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ): Promise<MarketData[]> {
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }

      if (from >= to) {
        throw new HttpException('fromDate must be before toDate', HttpStatus.BAD_REQUEST);
      }

      return await this.marketDataService.getHistoricalData(symbol, from, to);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to fetch historical data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to market data updates for specific pairs' })
  @ApiResponse({ status: 200, description: 'Successfully subscribed to pairs' })
  async subscribeToPairs(@Body() subscribeDto: SubscribePairsDto): Promise<{ message: string; pairs: string[] }> {
    try {
      await this.marketDataService.subscribeToPairs(subscribeDto.pairs);
      return {
        message: 'Successfully subscribed to market data updates',
        pairs: subscribeDto.pairs,
      };
    } catch (error) {
      throw new HttpException('Failed to subscribe to pairs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from market data updates for specific pairs' })
  @ApiResponse({ status: 200, description: 'Successfully unsubscribed from pairs' })
  async unsubscribeFromPairs(@Body() subscribeDto: SubscribePairsDto): Promise<{ message: string; pairs: string[] }> {
    try {
      await this.marketDataService.unsubscribeFromPairs(subscribeDto.pairs);
      return {
        message: 'Successfully unsubscribed from market data updates',
        pairs: subscribeDto.pairs,
      };
    } catch (error) {
      throw new HttpException('Failed to unsubscribe from pairs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check market data service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async getHealthStatus(): Promise<{
    status: string;
    providers: { name: string; connected: boolean }[];
    timestamp: string;
  }> {
    return {
      status: 'healthy',
      providers: [], // This would be populated with actual provider status
      timestamp: new Date().toISOString(),
    };
  }
}
