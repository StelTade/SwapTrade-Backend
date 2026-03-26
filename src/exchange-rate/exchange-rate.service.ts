import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import axios, { AxiosInstance } from 'axios';
import { ExchangeRateResponseDto, CachedExchangeRate } from './dto/exchange-rate.dto';

const CACHE_KEY = 'exchange_rates_usd';
const CACHE_TTL = 3600; // 1 hour in seconds
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

@Injectable()
export class ExchangeRateService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly exchangeRateUrl: string;
  private lastError: string | null = null;
  private lastSuccessfulUpdate: Date | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.exchangeRateUrl = this.configService.get<string>('EXCHANGE_RATE_URL') || '';
    
    this.axiosInstance = axios.create({
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  async onModuleInit() {
    // Pre-warm cache on startup
    try {
      await this.fetchAndCacheRates();
      this.logger.log('Exchange rates initialized successfully');
    } catch (error) {
      this.logger.warn('Failed to initialize exchange rates, will use fallback');
    }
  }

  /**
   * Get current exchange rates
   * Returns cached rates if available, otherwise fetches fresh
   */
  async getRates(): Promise<ExchangeRateResponseDto> {
    // Try to get from cache first
    const cached = await this.cacheManager.get<CachedExchangeRate>(CACHE_KEY);
    
    if (cached) {
      return {
        base: 'USD',
        rates: cached.rates,
        lastUpdated: cached.lastUpdated,
        source: cached.source,
      };
    }

    // Cache miss - fetch fresh rates
    try {
      const freshRates = await this.fetchAndCacheRates();
      return {
        base: 'USD',
        rates: freshRates.rates,
        lastUpdated: freshRates.lastUpdated,
        source: freshRates.source,
      };
    } catch (error) {
      this.logger.error('Failed to fetch exchange rates', error);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // Return fallback rates
      return {
        base: 'USD',
        rates: FALLBACK_RATES,
        lastUpdated: this.lastSuccessfulUpdate || new Date(),
        source: 'fallback',
      };
    }
  }

  /**
   * Get specific currency rate
   */
  async getRate(currency: string): Promise<number | null> {
    const { rates } = await this.getRates();
    return rates[currency.toUpperCase()] ?? null;
  }

  /**
   * Force refresh the exchange rates
   */
  async refresh(): Promise<ExchangeRateResponseDto> {
    this.logger.log('Force refreshing exchange rates');
    
    // Clear cache
    await this.cacheManager.del(CACHE_KEY);
    
    // Fetch fresh
    const freshRates = await this.fetchAndCacheRates();
    
    return {
      base: 'USD',
      rates: freshRates.rates,
      lastUpdated: freshRates.lastUpdated,
      source: freshRates.source,
    };
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastUpdate: Date | null;
    lastError: string | null;
    source: string;
  }> {
    const cached = await this.cacheManager.get<CachedExchangeRate>(CACHE_KEY);
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!cached && !this.lastSuccessfulUpdate) {
      status = 'unhealthy';
    } else if (this.lastError && !cached) {
      status = 'degraded';
    }
    
    return {
      status,
      lastUpdate: this.lastSuccessfulUpdate,
      lastError: this.lastError,
      source: cached?.source || 'none',
    };
  }

  /**
   * Fetch rates from external API and cache them
   */
  private async fetchAndCacheRates(): Promise<CachedExchangeRate> {
    if (!this.exchangeRateUrl) {
      this.logger.warn('EXCHANGE_RATE_URL not configured, using fallback rates');
      const fallbackData: CachedExchangeRate = {
        rates: FALLBACK_RATES,
        lastUpdated: new Date(),
        source: 'fallback',
      };
      await this.cacheManager.set(CACHE_KEY, fallbackData, CACHE_TTL * 1000);
      return fallbackData;
    }

    try {
      const response = await this.axiosInstance.get(this.exchangeRateUrl);
      const rates = this.parseRates(response.data);
      
      const cachedData: CachedExchangeRate = {
        rates,
        lastUpdated: new Date(),
        source: 'api',
      };
      
      // Cache for 1 hour
      await this.cacheManager.set(CACHE_KEY, cachedData, CACHE_TTL * 1000);
      
      this.lastSuccessfulUpdate = new Date();
      this.lastError = null;
      
      this.logger.debug('Exchange rates cached successfully');
      return cachedData;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // If we have previous cached data, extend its TTL and use it
      const existingCache = await this.cacheManager.get<CachedExchangeRate>(CACHE_KEY);
      if (existingCache) {
        this.logger.warn('Using cached rates due to fetch error');
        await this.cacheManager.set(CACHE_KEY, existingCache, CACHE_TTL * 1000);
        return existingCache;
      }
      
      // No cache available - use fallback
      this.logger.warn('Using fallback rates due to fetch error');
      const fallbackData: CachedExchangeRate = {
        rates: FALLBACK_RATES,
        lastUpdated: new Date(),
        source: 'fallback',
      };
      await this.cacheManager.set(CACHE_KEY, fallbackData, CACHE_TTL * 1000);
      return fallbackData;
    }
  }

  /**
   * Parse rates from API response
   * Handles multiple common response formats
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
}
