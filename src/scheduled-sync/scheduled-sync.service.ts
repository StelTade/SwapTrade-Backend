import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import { StellarSyncService } from './stellar-sync.service';

@Injectable()
export class ScheduledSyncService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledSyncService.name);

  constructor(
    private readonly exchangeRateSync: ExchangeRateSyncService,
    private readonly stellarSync: StellarSyncService,
  ) {}

  async onModuleInit() {
    this.logger.log('Scheduled sync service initialized');
    this.logSchedule();
  }

  /**
   * Log active scheduled jobs
   */
  private logSchedule(): void {
    this.logger.log('Active scheduled jobs:');
    this.logger.log('  - Exchange rate sync: Every hour (UTC)');
    this.logger.log('  - Stellar state poll: Every 5 minutes (if enabled)');
  }

  /**
   * Get comprehensive sync status
   */
  getFullStatus(): {
    exchangeRate: ReturnType<ExchangeRateSyncService['getStatus']>;
    stellar: ReturnType<StellarSyncService['getStatus']>;
    system: {
      uptime: number;
      initialized: Date;
    };
  } {
    return {
      exchangeRate: this.exchangeRateSync.getStatus(),
      stellar: this.stellarSync.getStatus(),
      system: {
        uptime: process.uptime(),
        initialized: new Date(),
      },
    };
  }

  /**
   * Trigger all syncs manually
   */
  async triggerAllSyncs(): Promise<{
    exchangeRate: { success: boolean; message: string };
    stellar: { success: boolean; message: string; data?: any };
  }> {
    this.logger.log('Triggering all scheduled syncs');

    const [exchangeRateResult, stellarResult] = await Promise.all([
      this.exchangeRateSync.triggerSync(),
      this.stellarSync.triggerPoll(),
    ]);

    return {
      exchangeRate: exchangeRateResult,
      stellar: stellarResult,
    };
  }

  /**
   * Health check for scheduled services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      exchangeRate: { status: string; lastSync: Date | null };
      stellar: { status: string; lastPoll: Date | null };
    };
  }> {
    const exchangeRateStatus = this.exchangeRateSync.getStatus();
    const stellarStatus = this.stellarSync.getStatus();

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check exchange rate health
    const exchangeRateHealthy = exchangeRateStatus.lastSync !== null;
    const stellarHealthy = stellarStatus.enabled ? stellarStatus.lastPoll !== null : true;

    if (!exchangeRateHealthy && !stellarHealthy) {
      overallStatus = 'unhealthy';
    } else if (!exchangeRateHealthy || !stellarHealthy) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      details: {
        exchangeRate: {
          status: exchangeRateHealthy ? 'ok' : 'error',
          lastSync: exchangeRateStatus.lastSync,
        },
        stellar: {
          status: stellarHealthy ? 'ok' : 'error',
          lastPoll: stellarStatus.lastPoll,
        },
      },
    };
  }
}
