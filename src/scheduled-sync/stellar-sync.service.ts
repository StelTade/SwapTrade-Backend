import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import axios, { AxiosInstance } from 'axios';

const STELLAR_CACHE_KEY = 'stellar_ledger_info';
const STELLAR_CACHE_TTL = 300; // 5 minutes

interface StellarLedgerInfo {
  sequence: number;
  hash: string;
  closeTime: Date;
  transactionCount: number;
  protocolVersion: number;
  lastUpdated: Date;
}

interface StellarMetrics {
  latestLedger: number;
  transactionCount: number;
  avgTransactionCount: number;
  lastPolled: Date | null;
  errors: number;
}

@Injectable()
export class StellarSyncService implements OnModuleInit {
  private readonly logger = new Logger(StellarSyncService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly horizonUrl: string;
  private readonly pollingEnabled: boolean;
  
  private lastError: string | null = null;
  private lastSuccessfulPoll: Date | null = null;
  private errorCount = 0;
  private isPolling = false;
  
  // Metrics tracking
  private recentTransactionCounts: number[] = [];

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL') || 'https://horizon.stellar.org';
    this.pollingEnabled = this.configService.get<string>('STELLAR_POLLING_ENABLED') === 'true';
    
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  async onModuleInit() {
    if (this.pollingEnabled) {
      this.logger.log(`Stellar polling enabled. URL: ${this.horizonUrl}`);
      // Initial poll
      await this.pollStellarState().catch(() => {
        this.logger.warn('Initial Stellar poll failed, will retry on schedule');
      });
    } else {
      this.logger.log('Stellar polling disabled. Set STELLAR_POLLING_ENABLED=true to enable.');
    }
  }

  /**
   * Scheduled Stellar state poll - every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'stellar-state-poll',
    timeZone: 'UTC',
  })
  async handleScheduledPoll(): Promise<void> {
    if (!this.pollingEnabled) {
      return;
    }

    this.logger.debug('Starting scheduled Stellar state poll');
    await this.pollStellarState();
  }

  /**
   * Manual trigger for Stellar poll
   */
  async triggerPoll(): Promise<{ success: boolean; message: string; data?: any }> {
    this.logger.log('Manual Stellar poll triggered');
    
    try {
      const result = await this.pollStellarState();
      return { 
        success: true, 
        message: 'Stellar state polled successfully',
        data: result 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Poll failed' 
      };
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): StellarMetrics {
    const avgTransactionCount = this.recentTransactionCounts.length > 0
      ? this.recentTransactionCounts.reduce((a, b) => a + b, 0) / this.recentTransactionCounts.length
      : 0;

    return {
      latestLedger: this.recentTransactionCounts.length > 0 ? 0 : 0, // Will be updated from cache
      transactionCount: this.recentTransactionCounts[this.recentTransactionCounts.length - 1] || 0,
      avgTransactionCount: Math.round(avgTransactionCount * 100) / 100,
      lastPolled: this.lastSuccessfulPoll,
      errors: this.errorCount,
    };
  }

  /**
   * Get polling status
   */
  getStatus(): {
    enabled: boolean;
    horizonUrl: string;
    lastPoll: Date | null;
    lastError: string | null;
    isPolling: boolean;
  } {
    return {
      enabled: this.pollingEnabled,
      horizonUrl: this.horizonUrl,
      lastPoll: this.lastSuccessfulPoll,
      lastError: this.lastError,
      isPolling: this.isPolling,
    };
  }

  /**
   * Core polling logic
   */
  private async pollStellarState(): Promise<StellarLedgerInfo | null> {
    if (this.isPolling) {
      this.logger.debug('Poll already in progress, skipping');
      return null;
    }

    this.isPolling = true;

    try {
      // Fetch latest ledger info
      const ledgerInfo = await this.fetchLatestLedger();
      
      // Cache the result
      await this.cacheManager.set(STELLAR_CACHE_KEY, ledgerInfo, STELLAR_CACHE_TTL * 1000);
      
      // Update metrics
      this.recentTransactionCounts.push(ledgerInfo.transactionCount);
      if (this.recentTransactionCounts.length > 12) { // Keep last hour
        this.recentTransactionCounts.shift();
      }
      
      this.lastSuccessfulPoll = new Date();
      this.lastError = null;
      this.errorCount = 0;
      
      this.logger.debug(
        `Stellar ledger ${ledgerInfo.sequence} polled. ` +
        `${ledgerInfo.transactionCount} transactions.`
      );
      
      return ledgerInfo;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.errorCount++;
      
      this.logger.error(`Stellar poll failed (attempt ${this.errorCount}): ${this.lastError}`);
      
      // Don't throw - we want the scheduler to continue
      return null;
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Fetch latest ledger from Stellar Horizon
   */
  private async fetchLatestLedger(): Promise<StellarLedgerInfo> {
    const response = await this.axiosInstance.get(`${this.horizonUrl}/ledgers?order=desc&limit=1`);
    
    const records = response.data?._embedded?.records;
    if (!records || records.length === 0) {
      throw new Error('No ledger records returned from Horizon');
    }

    const ledger = records[0];
    
    return {
      sequence: ledger.sequence,
      hash: ledger.hash,
      closeTime: new Date(ledger.closed_at),
      transactionCount: ledger.successful_transaction_count || 0,
      protocolVersion: ledger.protocol_version,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get USDC balance for an account (optional utility)
   */
  async getUSDCBalance(accountId: string): Promise<string | null> {
    try {
      // USDC asset on Stellar: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
      const response = await this.axiosInstance.get(
        `${this.horizonUrl}/accounts/${accountId}/data`
      );
      
      // This would need more complex logic to parse trustlines
      // For now, return null as this is optional
      return null;
    } catch (error) {
      this.logger.debug(`Could not fetch USDC balance for ${accountId}`);
      return null;
    }
  }
}
