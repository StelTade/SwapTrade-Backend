import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { WaitlistAnalyticsService } from './waitlist-analytics.service';
import { WaitlistStatsDto } from './dto/waitlist-stats.dto';

@Controller('admin/waitlist')
export class WaitlistAnalyticsController {
  constructor(
    private readonly analyticsService: WaitlistAnalyticsService,
  ) {}

  /**
   * Get comprehensive waitlist statistics
   * GET /api/admin/waitlist/stats
   * 
   * Query params:
   * - days: number of days for daily trends (default: 30)
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(
    @Query('days') days?: number,
  ): Promise<WaitlistStatsDto> {
    return this.analyticsService.getStats(days);
  }

  /**
   * Get summary stats for dashboard
   * GET /api/admin/waitlist/stats/summary
   */
  @Get('stats/summary')
  @HttpCode(HttpStatus.OK)
  async getSummaryStats(): Promise<{
    totalSignups: number;
    verifiedUsers: number;
    verificationRate: number;
    topReferrer: any;
    todaySignups: number;
    todayVerifications: number;
  }> {
    return this.analyticsService.getSummaryStats();
  }

  /**
   * Get top referrers
   * GET /api/admin/waitlist/referrers
   * 
   * Query params:
   * - limit: number of referrers to return (default: 10)
   */
  @Get('referrers')
  @HttpCode(HttpStatus.OK)
  async getTopReferrers(
    @Query('limit') limit?: number,
  ): Promise<{ referrers: any[] }> {
    const referrers = await this.analyticsService.getTopReferrers(limit || 10);
    return { referrers };
  }

  /**
   * Get daily trends
   * GET /api/admin/waitlist/trends
   * 
   * Query params:
   * - days: number of days to include (default: 30)
   */
  @Get('trends')
  @HttpCode(HttpStatus.OK)
  async getDailyTrends(
    @Query('days') days?: number,
  ): Promise<{ trends: any[] }> {
    const trends = await this.analyticsService.getDailyTrends(days || 30);
    return { trends };
  }

  /**
   * Get stats for a specific date range
   * GET /api/admin/waitlist/stats/range
   * 
   * Query params:
   * - startDate: ISO date string
   * - endDate: ISO date string
   */
  @Get('stats/range')
  @HttpCode(HttpStatus.OK)
  async getStatsForDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<Partial<WaitlistStatsDto>> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use ISO date string.');
    }
    
    return this.analyticsService.getStatsForDateRange(start, end);
  }
}
