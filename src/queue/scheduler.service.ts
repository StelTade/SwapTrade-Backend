import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { QueueService } from './queue.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { QueueAnalyticsService } from './queue-analytics.service';
import { CacheWarmingService } from '../common/cache/cache-warming.service';
import { QueueName } from './queue.constants';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly queueMonitoring: QueueMonitoringService,
    private readonly queueAnalytics: QueueAnalyticsService,
    private readonly cacheWarming: CacheWarmingService,
  ) {}

  private async recordTaskExecution(
    taskName: string,
    startTime: number,
    error?: Error,
  ): Promise<void> {
    const duration = Date.now() - startTime;
    this.queueMonitoring.recordScheduledTaskExecution(
      taskName,
      error ? 'failed' : 'completed',
      duration,
      error?.message,
    );
  }

  onModuleInit() {
    this.logger.log('Scheduler service initialized');
    this.logger.log('Scheduled jobs:');
    this.logger.log('  - Cache warming: Every 30 minutes');
    this.logger.log('  - Daily reports: 2:00 AM');
    this.logger.log('  - Weekly cleanup: Sunday 3:00 AM');
    this.logger.log('  - Hourly temp file cleanup: Every hour');
    this.logger.log('  - Session cleanup: Every 30 minutes');
    this.logger.log('  - Portfolio optimization: Daily at 1:00 AM');
    this.logger.log('  - Queue health check: Every 5 minutes');
  }

  onModuleDestroy() {
    this.logger.log('Scheduler service shutting down...');
  }

  // ==================== Daily Reports (2 AM) ====================

  @Cron('0 2 * * *', {
    name: 'daily-report-generation',
    timeZone: 'UTC',
  })
  async generateDailyReports(): Promise<void> {
    this.logger.log('Starting scheduled daily report generation');

    try {
      // Get admin emails from config or database
      const adminEmails = await this.getAdminEmails();

      for (const email of adminEmails) {
        await this.queueService.generateDailyReport(email);
      }

      this.logger.log(
        `Daily reports scheduled for ${adminEmails.length} recipients`,
      );
    } catch (error) {
      this.logger.error('Failed to schedule daily reports:', error);
    }
  }

  // ==================== Weekly Cleanup (Sunday 3 AM) ====================

  @Cron('0 3 * * 0', {
    name: 'weekly-cleanup',
    timeZone: 'UTC',
  })
  async performWeeklyCleanup(): Promise<void> {
    this.logger.log('Starting scheduled weekly cleanup');

    try {
      // Cleanup old completed trades (90 days)
      await this.queueService.cleanupOldTrades(90);

      // Cleanup old logs (30 days)
      await this.queueService.addCleanupJob({
        type: 'logs',
        olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        batchSize: 5000,
      });

      // Cleanup temp files (7 days)
      await this.queueService.addCleanupJob({
        type: 'temp_files',
        olderThan: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        batchSize: 1000,
      });

      // Generate weekly performance report
      await this.queueService.addReportJob({
        reportType: 'weekly',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        format: 'pdf',
        email: process.env.ADMIN_EMAIL || 'admin@swaptrade.com',
      });

      this.logger.log('Weekly cleanup jobs scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to schedule weekly cleanup:', error);
    }
  }

  // ==================== Hourly Cleanup ====================

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'hourly-temp-cleanup',
  })
  async cleanupTempFiles(): Promise<void> {
    this.logger.debug('Running hourly temp file cleanup');

    try {
      // Cleanup temp files older than 1 hour
      await this.queueService.addCleanupJob({
        type: 'temp_files',
        olderThan: new Date(Date.now() - 60 * 60 * 1000),
        batchSize: 500,
      });
    } catch (error) {
      this.logger.error('Failed to schedule temp cleanup:', error);
    }
  }

  // ==================== Session Cleanup (Every 30 minutes) ====================

  @Cron('*/30 * * * *', {
    name: 'session-cleanup',
  })
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.debug('Running session cleanup');

    try {
      await this.queueService.addCleanupJob({
        type: 'expired_sessions',
        batchSize: 1000,
      });
    } catch (error) {
      this.logger.error('Failed to schedule session cleanup:', error);
    }
  }

  // ==================== Monthly Reports (1st of month, 1 AM) ====================

  @Cron('0 1 1 * *', {
    name: 'monthly-report-generation',
    timeZone: 'UTC',
  })
  async generateMonthlyReports(): Promise<void> {
    this.logger.log('Starting scheduled monthly report generation');

    try {
      const adminEmails = await this.getAdminEmails();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);

      const endOfLastMonth = new Date(lastMonth);
      endOfLastMonth.setMonth(endOfLastMonth.getMonth() + 1);
      endOfLastMonth.setDate(0);
      endOfLastMonth.setHours(23, 59, 59, 999);

      for (const email of adminEmails) {
        await this.queueService.addReportJob({
          reportType: 'monthly',
          startDate: lastMonth,
          endDate: endOfLastMonth,
          format: 'pdf',
          email,
        });
      }

      this.logger.log('Monthly reports scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to schedule monthly reports:', error);
    }
  }

  // ==================== Cache Warming (Every 30 minutes) ====================

  @Cron('*/30 * * * *', {
    name: 'cache-warming',
  })
  async performCacheWarming(): Promise<void> {
    this.logger.debug('Running scheduled cache warming');
    const startTime = Date.now();

    try {
      const warmingResult = await this.cacheWarming.forceWarmCache();

      this.logger.log(
        `Cache warming completed: ${warmingResult.totalKeysWarmed} keys warmed, ` +
          `${warmingResult.successCount} successful, ${warmingResult.failureCount} failed`,
      );

      await this.recordTaskExecution('cache-warming', startTime);

      // Add notification if warming failed significantly
      if (warmingResult.failureCount > warmingResult.successCount) {
        await this.queueService.addNotificationJob({
          userId: 'admin',
          type: 'system_alert',
          title: 'Cache Warming Alert',
          message: `Cache warming had ${warmingResult.failureCount} failures out of ${warmingResult.totalKeysWarmed} keys`,
          priority: 'high',
        });
      }
    } catch (error) {
      this.logger.error('Failed to perform cache warming:', error);
      await this.recordTaskExecution('cache-warming', startTime, error);

      // Add alert notification
      await this.queueService.addNotificationJob({
        userId: 'admin',
        type: 'system_alert',
        title: 'Cache Warming Failed',
        message: `Cache warming job failed: ${error.message}`,
        priority: 'high',
      });
    }
  }

  // ==================== Portfolio Optimization (Daily at 1 AM) ====================

  @Cron('0 1 * * *', {
    name: 'portfolio-optimization',
    timeZone: 'UTC',
  })
  async performPortfolioOptimization(): Promise<void> {
    this.logger.log('Starting scheduled daily portfolio optimization');

    try {
      // Queue portfolio optimization jobs for all users with active balances
      await this.queueService.addReportJob({
        reportType: 'custom',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        endDate: new Date(),
        format: 'xlsx',
        filters: {
          includeOptimization: true,
          optimizationType: 'daily',
        },
      });

      this.logger.log('Portfolio optimization jobs scheduled successfully');
    } catch (error) {
      this.logger.error('Failed to schedule portfolio optimization:', error);
    }
  }

  // ==================== Queue Health Monitoring (Every 5 minutes) ====================

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'system-health-check',
  })
  async checkSystemHealth(): Promise<void> {
    this.logger.debug('Running system health check');

    try {
      // Check queue health for all queues
      const queueNames: QueueName[] = Object.values(QueueName);
      const unhealthyQueues: string[] = [];

      for (const queueName of queueNames) {
        const health = this.queueAnalytics.getQueueHealth(queueName);
        if (health.status !== 'healthy') {
          unhealthyQueues.push(`${queueName}: ${health.issues.join(', ')}`);
        }
      }

      // Send alert if any queues are unhealthy
      if (unhealthyQueues.length > 0) {
        await this.queueService.addNotificationJob({
          userId: 'admin',
          type: 'system_alert',
          title: 'Queue Health Alert',
          message: `Unhealthy queues detected: ${unhealthyQueues.join('; ')}`,
          priority: 'high',
        });

        this.logger.warn(
          `Queue health issues detected: ${unhealthyQueues.join('; ')}`,
        );
      }

      // Additional system checks can be added here
      /*
      const healthStatus = await this.healthService.check();
      
      if (!healthStatus.healthy) {
        await this.queueService.addNotificationJob({
          userId: 'admin',
          type: 'system_alert',
          title: 'System Health Alert',
          message: `System health issues detected: ${healthStatus.issues.join(', ')}`,
          priority: 'high',
        });
      }
      */
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  // ==================== Helper Methods ====================

  private async getAdminEmails(): Promise<string[]> {
    // In production, fetch from database or config
    return [process.env.ADMIN_EMAIL || 'admin@swaptrade.com'].filter(Boolean);
  }

  // ==================== Manual Trigger Methods ====================

  async triggerDailyReport(email?: string): Promise<void> {
    this.logger.log('Manually triggering daily report');
    await this.queueService.generateDailyReport(email);
  }

  async triggerWeeklyCleanup(): Promise<void> {
    this.logger.log('Manually triggering weekly cleanup');
    await this.performWeeklyCleanup();
  }

  async triggerCustomReport(
    startDate: Date,
    endDate: Date,
    email: string,
    format: 'pdf' | 'csv' | 'xlsx' = 'pdf',
  ): Promise<void> {
    this.logger.log(`Triggering custom report for ${email}`);

    await this.queueService.addReportJob({
      reportType: 'custom',
      startDate,
      endDate,
      format,
      email,
    });
  }

  async triggerCacheWarming(): Promise<void> {
    this.logger.log('Manually triggering cache warming');
    const result = await this.cacheWarming.forceWarmCache();
    this.logger.log(
      `Cache warming completed: ${result.totalKeysWarmed} keys, ` +
        `${result.successCount} success, ${result.failureCount} failed`,
    );
  }

  async triggerPortfolioOptimization(): Promise<void> {
    this.logger.log('Manually triggering portfolio optimization');
    await this.performPortfolioOptimization();
  }

  getSchedulerStatus(): any {
    return {
      status: 'running',
      scheduledJobs: [
        {
          name: 'cache-warming',
          schedule: '*/30 * * * *',
          description: 'Cache warming every 30 minutes',
        },
        {
          name: 'daily-report-generation',
          schedule: '0 2 * * *',
          description: 'Daily reports at 2 AM',
        },
        {
          name: 'portfolio-optimization',
          schedule: '0 1 * * *',
          description: 'Portfolio optimization at 1 AM',
        },
        {
          name: 'weekly-cleanup',
          schedule: '0 3 * * 0',
          description: 'Weekly cleanup on Sunday 3 AM',
        },
        {
          name: 'hourly-temp-cleanup',
          schedule: '0 * * * *',
          description: 'Hourly temp file cleanup',
        },
        {
          name: 'session-cleanup',
          schedule: '*/30 * * * *',
          description: 'Session cleanup every 30 minutes',
        },
        {
          name: 'system-health-check',
          schedule: '*/5 * * * *',
          description: 'System health check every 5 minutes',
        },
        {
          name: 'monthly-report-generation',
          schedule: '0 1 1 * *',
          description: 'Monthly reports on 1st at 1 AM',
        },
      ],
    };
  }
}
