import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { WaitlistUser, WaitlistStatus } from '../waitlist/entities/waitlist-user.entity';
import { MetricsService } from '../../metrics/metrics.service';
import {
  WaitlistStatsDto,
  ReferrerStatsDto,
  DailyTrendDto,
} from './dto/waitlist-stats.dto';

@Injectable()
export class WaitlistAnalyticsService {
  private readonly logger = new Logger(WaitlistAnalyticsService.name);

  constructor(
    @InjectRepository(WaitlistUser)
    private readonly waitlistRepo: Repository<WaitlistUser>,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Get comprehensive waitlist statistics
   */
  async getStats(days?: number): Promise<WaitlistStatsDto> {
    this.logger.log('Generating waitlist statistics');

    // Get basic counts
    const [
      totalSignups,
      verifiedUsers,
      pendingUsers,
      invitedUsers,
      referralConversions,
    ] = await Promise.all([
      this.getTotalSignups(),
      this.getVerifiedUsers(),
      this.getUsersByStatus(WaitlistStatus.PENDING),
      this.getUsersByStatus(WaitlistStatus.INVITED),
      this.getReferralConversions(),
    ]);

    // Calculate rates
    const verificationRate = totalSignups > 0 
      ? Number((verifiedUsers / totalSignups * 100).toFixed(2))
      : 0;
    
    const referralConversionRate = totalSignups > 0
      ? Number((referralConversions / totalSignups * 100).toFixed(2))
      : 0;

    // Get top referrers and daily trends in parallel
    const [topReferrers, dailyTrends] = await Promise.all([
      this.getTopReferrers(10),
      this.getDailyTrends(days || 30),
    ]);

    // Update Prometheus metrics
    this.updatePrometheusMetrics({
      totalSignups,
      verifiedUsers,
      pendingUsers,
      referralConversions,
    });

    return {
      totalSignups,
      verifiedUsers,
      pendingUsers,
      invitedUsers,
      referralConversions,
      referralConversionRate,
      verificationRate,
      topReferrers,
      dailyTrends,
      generatedAt: new Date(),
    };
  }

  /**
   * Get total number of signups
   */
  private async getTotalSignups(): Promise<number> {
    return this.waitlistRepo.count();
  }

  /**
   * Get number of verified users
   */
  private async getVerifiedUsers(): Promise<number> {
    return this.waitlistRepo.count({
      where: { status: WaitlistStatus.VERIFIED },
    });
  }

  /**
   * Get users count by status
   */
  private async getUsersByStatus(status: WaitlistStatus): Promise<number> {
    return this.waitlistRepo.count({
      where: { status },
    });
  }

  /**
   * Get number of referral conversions (verified users who were referred)
   */
  private async getReferralConversions(): Promise<number> {
    return this.waitlistRepo.count({
      where: {
        status: WaitlistStatus.VERIFIED,
        referredBy: Not(null),
      } as any,
    });
  }

  /**
   * Get top referrers with their stats
   */
  async getTopReferrers(limit: number = 10): Promise<ReferrerStatsDto[]> {
    // Query to get referral counts grouped by referrer
    const referrers = await this.waitlistRepo
      .createQueryBuilder('referrer')
      .select('referrer.referralCode', 'referralCode')
      .addSelect('COUNT(referred.id)', 'referralCount')
      .addSelect(
        'SUM(CASE WHEN referred.status = :verified THEN 1 ELSE 0 END)',
        'verifiedReferrals'
      )
      .innerJoin(
        WaitlistUser,
        'referred',
        'referred.referredBy = referrer.referralCode'
      )
      .where('referrer.referralCode IS NOT NULL')
      .setParameter('verified', WaitlistStatus.VERIFIED)
      .groupBy('referrer.referralCode')
      .orderBy('referralCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return referrers.map(r => ({
      referralCode: r.referralCode,
      referralCount: parseInt(r.referralCount, 10),
      verifiedReferrals: parseInt(r.verifiedReferrals, 10),
    }));
  }

  /**
   * Get daily trends for the specified number of days
   */
  async getDailyTrends(days: number = 30): Promise<DailyTrendDto[]> {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Get daily signups
    const dailySignups = await this.waitlistRepo
      .createQueryBuilder('user')
      .select("DATE(user.createdAt)", 'date')
      .addSelect('COUNT(*)', 'signups')
      .where('user.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy("DATE(user.createdAt)")
      .orderBy('date', 'ASC')
      .getRawMany();

    // Get daily verifications
    const dailyVerifications = await this.waitlistRepo
      .createQueryBuilder('user')
      .select("DATE(user.verifiedAt)", 'date')
      .addSelect('COUNT(*)', 'verifications')
      .where('user.verifiedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('user.status = :verified', { verified: WaitlistStatus.VERIFIED })
      .groupBy("DATE(user.verifiedAt)")
      .getRawMany();

    // Get daily conversions
    const dailyConversions = await this.waitlistRepo
      .createQueryBuilder('user')
      .select("DATE(user.verifiedAt)", 'date')
      .addSelect('COUNT(*)', 'conversions')
      .where('user.verifiedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('user.referredBy IS NOT NULL')
      .andWhere('user.status = :verified', { verified: WaitlistStatus.VERIFIED })
      .groupBy("DATE(user.verifiedAt)")
      .getRawMany();

    // Merge data into daily trends
    const trendsMap = new Map<string, DailyTrendDto>();

    // Initialize all dates with zeros
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      trendsMap.set(dateStr, {
        date: dateStr,
        signups: 0,
        verifications: 0,
        conversions: 0,
      });
    }

    // Fill in signups
    dailySignups.forEach(s => {
      const trend = trendsMap.get(s.date);
      if (trend) trend.signups = parseInt(s.signups, 10);
    });

    // Fill in verifications
    dailyVerifications.forEach(v => {
      const trend = trendsMap.get(v.date);
      if (trend) trend.verifications = parseInt(v.verifications, 10);
    });

    // Fill in conversions
    dailyConversions.forEach(c => {
      const trend = trendsMap.get(c.date);
      if (trend) trend.conversions = parseInt(c.conversions, 10);
    });

    return Array.from(trendsMap.values());
  }

  /**
   * Get stats for a specific date range
   */
  async getStatsForDateRange(startDate: Date, endDate: Date): Promise<Partial<WaitlistStatsDto>> {
    const [signups, verifications, conversions] = await Promise.all([
      this.waitlistRepo.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.waitlistRepo.count({
        where: {
          verifiedAt: Between(startDate, endDate),
          status: WaitlistStatus.VERIFIED,
        },
      }),
      this.waitlistRepo.count({
        where: {
          verifiedAt: Between(startDate, endDate),
          status: WaitlistStatus.VERIFIED,
          referredBy: Not(null),
        } as any,
      }),
    ]);

    return {
      totalSignups: signups,
      verifiedUsers: verifications,
      referralConversions: conversions,
      generatedAt: new Date(),
    };
  }

  /**
   * Update Prometheus metrics
   */
  private updatePrometheusMetrics(stats: {
    totalSignups: number;
    verifiedUsers: number;
    pendingUsers: number;
    referralConversions: number;
  }): void {
    try {
      const verificationRate = stats.totalSignups > 0 
        ? Number((stats.verifiedUsers / stats.totalSignups * 100).toFixed(2))
        : 0;
      
      const referralConversionRate = stats.totalSignups > 0
        ? Number((stats.referralConversions / stats.totalSignups * 100).toFixed(2))
        : 0;

      this.metricsService.setWaitlistMetrics({
        ...stats,
        referralConversionRate,
        verificationRate,
      });
      
      this.logger.debug('Updated Prometheus metrics', stats);
    } catch (error) {
      this.logger.error('Failed to update Prometheus metrics', error);
    }
  }

  /**
   * Get summary stats for admin dashboard
   */
  async getSummaryStats(): Promise<{
    totalSignups: number;
    verifiedUsers: number;
    verificationRate: number;
    topReferrer: ReferrerStatsDto | null;
    todaySignups: number;
    todayVerifications: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [stats, topReferrers, todayStats] = await Promise.all([
      this.getStats(0),
      this.getTopReferrers(1),
      this.getStatsForDateRange(today, tomorrow),
    ]);

    return {
      totalSignups: stats.totalSignups,
      verifiedUsers: stats.verifiedUsers,
      verificationRate: stats.verificationRate,
      topReferrer: topReferrers[0] || null,
      todaySignups: todayStats.totalSignups || 0,
      todayVerifications: todayStats.verifiedUsers || 0,
    };
  }
}

// Import Not for TypeORM
import { Not } from 'typeorm';
