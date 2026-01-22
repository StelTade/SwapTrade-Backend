// src/queue/scheduler.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from './queue.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    this.logger.log('Scheduler service initialized');
    this.logger.log('Scheduled jobs:');
    this.logger.log('  - Daily reports: 2:00 AM');
    this.logger.log('  - Weekly cleanup: Sunday 3:00 AM');
    this.logger.log('  - Hourly temp file cleanup: Every hour');
    this.logger.log('  - Session cleanup: Every 30 minutes');
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

  // ==================== Health Check Notifications (Every 5 minutes) ====================

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'system-health-check',
  })
  async checkSystemHealth(): Promise<void> {
    this.logger.debug('Running system health check');

    try {
      // This would typically check database, Redis, external services, etc.
      // If issues are detected, send alerts
      
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
    return [
      process.env.ADMIN_EMAIL || 'admin@swaptrade.com',
    ].filter(Boolean);
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
}