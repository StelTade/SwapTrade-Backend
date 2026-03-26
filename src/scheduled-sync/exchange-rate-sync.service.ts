import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import axios, { AxiosInstance } from 'axios';

const CACHE_KEY = 'exchange_rates_usd';
const CACHE_TTL = 3600; // 1 hour in seconds

// Fallback rates for major currencies
const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
};

interface CachedExchangeRate {
  rates: Record<string, number>;
  lastUpdated: Date;
  source: string;
}

@Injectable()
export class ExchangeRateSyncService {
  private readonly logger = new Logger(ExchangeRateSyncService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly exchangeRateUrl: string;
  private lastError: string | null = null;
  private lastSuccessfulSync: Date | null = null;
  private isSyncing = false;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.exchangeRateUrl = this.configService.get<string>('EXCHANGE_RATE_URL') || '';
    
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: { 'Accept': 'application/json' },
    });

    // Initial sync on startup
    this.syncExchangeRates().catch(err => {
      this.logger.warn('Initial exchange rate sync failed, will retry on schedule');
    });
  }

  /**
   * Scheduled exchange rate sync - every 60 minutes
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'exchange-rate-sync',
    timeZone: 'UTC',
  })
  async handleHourlySync(): Promise<void> {
    this.logger.log('Starting scheduled exchange rate sync');
    await this.syncExchangeRates();
  }

  /**
   * Manual trigger for exchange rate sync
   */
  async triggerSync(): Promise<{ success: boolean; message: string }> {
    this.logger.log('Manual exchange rate sync triggered');
    
    try {
      await this.syncExchangeRates();
      return { success: true, message: 'Exchange rates synced successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Sync failed' 
      };
    }
  }

  /**
   * Get sync status
   */
  getStatus(): {
    lastSync: Date | null;
    lastError: string | null;
    isSyncing: boolean;
    url: string;
  } {
    return {
      lastSync: this.lastSuccessfulSync,
      lastError: this.lastError,
      isSyncing: this.isSyncing,
      url: this.exchangeRateUrl ? '[configured]' : '[not configured]',
    };
  }

  /**
   * Core sync logic
   */
  private async syncExchangeRates(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      const rates = await this.fetchRates();
      
      const cachedData: CachedExchangeRate = {
        rates,
        lastUpdated: new Date(),
        source: 'api',
      };

      await this.cacheManager.set(CACHE_KEY, cachedData, CACHE_TTL * 1000);
      
      this.lastSuccessfulSync = new Date();
      this.lastError = null;
      
      this.logger.log(`Exchange rates synced successfully. ${Object.keys(rates).length} currencies updated.`);
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Exchange rate sync failed: ${this.lastError}`);
      
      // Try to use fallback rates
      await this.useFallbackRates();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch rates from external API
   */
  private async fetchRates(): Promise<Record<string, number>> {
    if (!this.exchangeRateUrl) {
      this.logger.warn('EXCHANGE_RATE_URL not configured, using fallback');
      return FALLBACK_RATES;
    }

    const response = await this.axiosInstance.get(this.exchangeRateUrl);
    return this.parseRates(response.data);
  }

  /**
   * Parse rates from various API response formats
   */
  private parseRates(data: any): Record<string, number> {
    // Format 1: { rates: { EUR: 0.92, ... } }
    if (data.rates && typeof data.rates === 'object') {
      return data.rates;
    }
    
    // Format 2: { data: { EUR: 0.92, ... } }
    if (data.data && typeof data.data === 'object') {
      return data.data;
    }
    
    // Format 3: { EUR: 0.92, GBP: 0.79, ... }
    if (typeof data === 'object' && !Array.isArray(data)) {
      const rates: Record<string, number> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'number') {
          rates[key.toUpperCase()] = value;
        }
      }
      if (Object.keys(rates).length > 0) {
        return rates;
      }
    }
    
    throw new Error('Unable to parse exchange rates from API response');
  }

  /**
   * Use fallback rates when API fails
   */
  private async useFallbackRates(): Promise<void> {
    const cachedData: CachedExchangeRate = {
      rates: FALLBACK_RATES,
      lastUpdated: new Date(),
      source: 'fallback',
    };

    await this.cacheManager.set(CACHE_KEY, cachedData, CACHE_TTL * 1000);
    this.logger.warn('Using fallback exchange rates');
  }
}
