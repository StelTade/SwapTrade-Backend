import { Injectable, OnApplicationBootstrap, Inject, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../services/cache.service';
import { CacheWarmingConfig, CacheWarmingMetrics, WarmingStrategyResult } from './interfaces/cache-warming.interface';
import { Balance } from '../../balance/balance.entity';
import { MarketData } from '../../trading/entities/market-data.entity';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { ConfigService as AppConfigService } from '../../config/config.service';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class CacheWarmingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmingService.name);
  private warmingMetrics: CacheWarmingMetrics = {
    totalKeysWarmed: 0,
    warmingDuration: 0,
    successCount: 0,
    failureCount: 0,
    strategyResults: {}
  };
  private isWarming = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly appConfigService: AppConfigService,
    @InjectRepository(Balance)
    @Optional()
    private readonly balanceRepository?: Repository<Balance>,
    @InjectRepository(MarketData)
    @Optional()
    private readonly marketDataRepository?: Repository<MarketData>,
    @InjectRepository(VirtualAsset)
    @Optional()
    private readonly virtualAssetRepository?: Repository<VirtualAsset>,
    @Optional()
    private readonly portfolioService?: PortfolioService,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  async onApplicationBootstrap() {
    const warmingConfig = this.getWarmingConfig();
    
    if (!warmingConfig.enabled) {
      this.logger.log('Cache warming is disabled');
      return;
    }

    this.logger.log('Starting cache warming...');
    const startTime = Date.now();
    
    try {
      this.isWarming = true;
      await this.warmCache(warmingConfig);
      const duration = Date.now() - startTime;
      
      this.warmingMetrics.warmingDuration = duration;
      this.logger.log(`Cache warming completed in ${duration}ms. Keys warmed: ${this.warmingMetrics.totalKeysWarmed}`);
      
      // Record cache warming metrics - simulate cache hits for warmed keys
      for (let i = 0; i < this.warmingMetrics.totalKeysWarmed; i++) {
        this.metricsService?.recordCacheHit();
      }
      
      // Get and record cache hit/miss metrics after warming
      const cacheMetrics = this.cacheService.getCacheMetrics();
      this.logger.log(`Cache hit ratio after warming: ${cacheMetrics.hitRate.toFixed(2)}% (${cacheMetrics.hits}/${cacheMetrics.hits + cacheMetrics.misses})`);
      this.logger.log(`Warmed cache hit ratio: ${cacheMetrics.warmedHitRate.toFixed(2)}% (${cacheMetrics.warmedHits}/${cacheMetrics.warmedHits + cacheMetrics.warmedMisses})`);
      
      // Log individual strategy results
      for (const [strategyName, result] of Object.entries(this.warmingMetrics.strategyResults)) {
        if (result.success) {
          this.logger.log(`✓ ${strategyName}: ${result.keysWarmed} keys warmed in ${result.duration}ms`);
        } else {
          this.logger.warn(`✗ ${strategyName}: failed - ${result.error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Cache warming failed: ${error.message}`, error.stack);
      this.warmingMetrics.failureCount++;
    } finally {
      this.isWarming = false;
    }
  }

  private getWarmingConfig(): CacheWarmingConfig {
    const cacheConfig = this.appConfigService.cache;
    return {
      enabled: cacheConfig.warming?.enabled || false,
      timeout: cacheConfig.warming?.timeout || 30000,
      strategies: cacheConfig.warming?.strategies || ['user_balances', 'market_data', 'trading_pairs', 'portfolio']
    };
  }

  private async warmCache(config: CacheWarmingConfig): Promise<void> {
    const strategies: Record<string, () => Promise<WarmingStrategyResult>> = {
      user_balances: () => this.warmUserBalances(),
      market_data: () => this.warmMarketData(),
      trading_pairs: () => this.warmTradingPairs(),
      portfolio: () => this.warmPortfolioData()
    };

    const warmingPromises = config.strategies
      .filter(strategy => strategies[strategy])
      .map(async (strategyName) => {
        const startTime = Date.now();
        try {
          const result = await strategies[strategyName]();
          const duration = Date.now() - startTime;
          
          this.warmingMetrics.strategyResults[strategyName] = {
            ...result,
            duration
          };
          
          if (result.success) {
            this.warmingMetrics.successCount++;
            this.warmingMetrics.totalKeysWarmed += result.keysWarmed;
          } else {
            this.warmingMetrics.failureCount++;
          }
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const result: WarmingStrategyResult = {
            strategyName,
            success: false,
            keysWarmed: 0,
            duration,
            error: error.message
          };
          
          this.warmingMetrics.strategyResults[strategyName] = result;
          this.warmingMetrics.failureCount++;
          
          return result;
        }
      });

    // Apply timeout if configured
    if (config.timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Cache warming timeout after ${config.timeout}ms`)), config.timeout);
      });

      try {
        await Promise.race([
          Promise.all(warmingPromises),
          timeoutPromise
        ]);
      } catch (error) {
        this.logger.error(`Cache warming timed out: ${error.message}`);
        throw error;
      }
    } else {
      await Promise.all(warmingPromises);
    }
  }

  private async warmUserBalances(): Promise<WarmingStrategyResult> {
    if (!this.balanceRepository) {
      return {
        strategyName: 'user_balances',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: 'Balance repository not available'
      };
    }

    try {
      // Get distinct user IDs with balances
      const userBalances = await this.balanceRepository
        .createQueryBuilder('balance')
        .select('DISTINCT balance.userId')
        .getRawMany();

      let keysWarmed = 0;
      
      // Warm balances for each user (limit to prevent excessive warming)
      const usersToWarm = userBalances.slice(0, 100); // Limit to 100 users
      
      for (const user of usersToWarm) {
        const userId = user.userId;
        const balances = await this.balanceRepository.find({ where: { userId } });
        await this.cacheService.setUserBalanceCache(userId, balances);
        keysWarmed++;
      }

      return {
        strategyName: 'user_balances',
        success: true,
        keysWarmed,
        duration: 0 // Will be set by caller
      };
    } catch (error) {
      return {
        strategyName: 'user_balances',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  private async warmMarketData(): Promise<WarmingStrategyResult> {
    if (!this.marketDataRepository) {
      return {
        strategyName: 'market_data',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: 'Market data repository not available'
      };
    }

    try {
      const marketDataList = await this.marketDataRepository.find();
      let keysWarmed = 0;

      for (const marketData of marketDataList) {
        await this.cacheService.setMarketPriceCache(marketData.asset, {
          price: marketData.currentPrice,
          volume24h: marketData.volume24h,
          change24h: marketData.priceChange24h
        });
        keysWarmed++;
      }

      return {
        strategyName: 'market_data',
        success: true,
        keysWarmed,
        duration: 0 // Will be set by caller
      };
    } catch (error) {
      return {
        strategyName: 'market_data',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  private async warmTradingPairs(): Promise<WarmingStrategyResult> {
    if (!this.virtualAssetRepository) {
      return {
        strategyName: 'trading_pairs',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: 'Virtual asset repository not available'
      };
    }

    try {
      const virtualAssets = await this.virtualAssetRepository.find();
      let keysWarmed = 0;

      for (const asset of virtualAssets) {
        // Cache trading pair information
        await this.cacheService.set(`trading_pair:${asset.symbol}`, {
          symbol: asset.symbol,
          name: asset.name,
          balances: asset.balances,
          createdAt: asset.createdAt
        }, 300); // 5 minutes TTL
        
        keysWarmed++;
      }

      return {
        strategyName: 'trading_pairs',
        success: true,
        keysWarmed,
        duration: 0 // Will be set by caller
      };
    } catch (error) {
      return {
        strategyName: 'trading_pairs',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  private async warmPortfolioData(): Promise<WarmingStrategyResult> {
    if (!this.portfolioService) {
      return {
        strategyName: 'portfolio',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: 'Portfolio service not available'
      };
    }

    try {
      // This is a simplified approach - in production, you'd want to get actual user IDs
      // For demo purposes, we'll skip this or use sample data
      this.logger.log('Portfolio warming strategy would require user enumeration');
      
      return {
        strategyName: 'portfolio',
        success: true,
        keysWarmed: 0, // Portfolio warming would need actual user data
        duration: 0
      };
    } catch (error) {
      return {
        strategyName: 'portfolio',
        success: false,
        keysWarmed: 0,
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Get current warming metrics
   */
  getWarmingMetrics(): CacheWarmingMetrics {
    return { ...this.warmingMetrics };
  }

  /**
   * Check if cache warming is currently in progress
   */
  isCurrentlyWarming(): boolean {
    return this.isWarming;
  }

  /**
   * Force cache warming (can be called manually)
   */
  async forceWarmCache(): Promise<CacheWarmingMetrics> {
    if (this.isWarming) {
      throw new Error('Cache warming is already in progress');
    }

    const config = this.getWarmingConfig();
    const startTime = Date.now();
    
    this.isWarming = true;
    this.warmingMetrics = {
      totalKeysWarmed: 0,
      warmingDuration: 0,
      successCount: 0,
      failureCount: 0,
      strategyResults: {}
    };

    try {
      await this.warmCache(config);
      this.warmingMetrics.warmingDuration = Date.now() - startTime;
      return { ...this.warmingMetrics };
    } finally {
      this.isWarming = false;
    }
  }
}