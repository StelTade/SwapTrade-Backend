import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { CacheService } from './cache.service';

export interface CacheWarmingTask {
  name: string;
  description: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  duration?: number; // milliseconds
}

/**
 * Advanced cache warming service
 * Pre-populates cache during off-peak hours to improve performance
 */
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private tasks: Map<string, CacheWarmingTask> = new Map();
  private isWarming = false;

  constructor(
    private readonly cacheService: CacheService,
  ) {
    this.initializeTasks();
  }

  onModuleInit() {
    this.logger.log('Cache warming service initialized');
  }

  /**
   * Warm user balance cache (runs every 30 minutes)
   */
  @Interval(30 * 60 * 1000)
  async warmUserBalances(): Promise<void> {
    if (!this.isWarming) {
      await this.executeTask('user_balances', async () => {
        this.logger.log('Warming user balance cache...');
        // In production, fetch all active users and warm their balance caches
        // For now, this is a placeholder
        this.logger.log('User balance cache warming completed');
      });
    }
  }

  /**
   * Warm market data cache (runs every 5 minutes)
   */
  @Interval(5 * 60 * 1000)
  async warmMarketData(): Promise<void> {
    if (!this.isWarming) {
      await this.executeTask('market_data', async () => {
        this.logger.log('Warming market data cache...');
        // Pre-populate commonly requested market symbols
        const symbols = ['BTC', 'ETH', 'USD'];
        for (const symbol of symbols) {
          // This would call an external API and cache results
          this.logger.debug(`Warmed cache for ${symbol}`);
        }
        this.logger.log('Market data cache warming completed');
      });
    }
  }

  /**
   * Full cache warming (runs at 2 AM daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async fullCacheWarming(): Promise<void> {
    if (!this.isWarming) {
      await this.executeTask('full_warming', async () => {
        this.logger.log('Starting full cache warming cycle...');
        const startTime = Date.now();

        // Warm multiple data sources
        await Promise.all([
          this.warmUserBalances(),
          this.warmMarketData(),
          this.warmPortfolioMetadata(),
        ]);

        const duration = Date.now() - startTime;
        this.logger.log(`Full cache warming completed in ${duration}ms`);
      });
    }
  }

  /**
   * Warm portfolio metadata cache
   */
  private async warmPortfolioMetadata(): Promise<void> {
    this.logger.log('Warming portfolio metadata cache...');
    // Pre-compute common portfolio stats
    this.logger.log('Portfolio metadata cache warming completed');
  }

  /**
   * Get all warming tasks status
   */
  getTasks(): CacheWarmingTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get specific task status
   */
  getTaskStatus(taskName: string): CacheWarmingTask | undefined {
    return this.tasks.get(taskName);
  }

  /**
   * Manually trigger cache warming
   */
  async triggerWarming(taskName?: string): Promise<void> {
    if (taskName) {
      const task = this.tasks.get(taskName);
      if (task && task.enabled) {
        this.logger.log(`Manually triggered cache warming: ${taskName}`);
        if (taskName === 'user_balances') {
          await this.warmUserBalances();
        } else if (taskName === 'market_data') {
          await this.warmMarketData();
        } else if (taskName === 'full_warming') {
          await this.fullCacheWarming();
        }
      }
    } else {
      await this.fullCacheWarming();
    }
  }

  /**
   * Disable/enable a warming task
   */
  setTaskEnabled(taskName: string, enabled: boolean): void {
    const task = this.tasks.get(taskName);
    if (task) {
      task.enabled = enabled;
      this.logger.log(
        `Cache warming task '${taskName}' ${enabled ? 'enabled' : 'disabled'}`,
      );
    }
  }

  /**
   * Private: Execute a warming task with error handling
   */
  private async executeTask(
    taskName: string,
    task: () => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();
    this.isWarming = true;
    const taskRecord = this.tasks.get(taskName);

    try {
      await task();
      const duration = Date.now() - startTime;
      if (taskRecord) {
        taskRecord.lastRun = new Date();
        taskRecord.duration = duration;
      }
    } catch (error) {
      this.logger.error(
        `Cache warming task '${taskName}' failed:`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Private: Initialize warming tasks
   */
  private initializeTasks(): void {
    this.tasks.set('user_balances', {
      name: 'user_balances',
      description: 'Warm user balance cache',
      enabled: true,
      lastRun: undefined,
    });

    this.tasks.set('market_data', {
      name: 'market_data',
      description: 'Warm market data cache',
      enabled: true,
      lastRun: undefined,
    });

    this.tasks.set('full_warming', {
      name: 'full_warming',
      description: 'Full cache warming cycle',
      enabled: true,
      lastRun: undefined,
    });
  }
}
