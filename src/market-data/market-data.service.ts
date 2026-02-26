import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketData } from '../trading/entities/market-data.entity';
import { MarketDataProvider, PriceUpdate, MarketDataConfig } from './interfaces/market-provider.interface';
import { BinanceProvider } from './providers/binance-provider';
import { CoinbaseProvider } from './providers/coinbase-provider';
import { MarketDataValidatorService } from './services/market-data-validator.service';
import { CacheService } from '../common/services/cache.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private providers: Map<string, MarketDataProvider> = new Map();
  private primaryProvider: MarketDataProvider | null = null;
  private fallbackProviders: MarketDataProvider[] = [];
  private readonly config: MarketDataConfig;
  private readonly cacheKeyPrefix = 'market_data:';
  private readonly cacheTTL = 60;

  constructor(
    @InjectRepository(MarketData)
    private readonly marketDataRepository: Repository<MarketData>,
    private readonly validatorService: MarketDataValidatorService,
    private readonly cacheService: CacheService,
  ) {
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    await this.initializeProviders();
    await this.connectProviders();
    this.startPeriodicUpdates();
  }

  async onModuleDestroy() {
    await this.disconnectAllProviders();
  }

  private loadConfig(): MarketDataConfig {
    return {
      providers: [
        {
          name: 'binance',
          type: 'websocket',
          url: 'wss://stream.binance.com:9443/ws',
          pairs: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'],
          updateInterval: 1000,
        },
        {
          name: 'coinbase',
          type: 'websocket',
          url: 'wss://ws-feed.exchange.coinbase.com',
          pairs: ['BTC-USD', 'ETH-USD', 'BNB-USD', 'ADA-USD', 'DOT-USD'],
          updateInterval: 1000,
        },
      ],
      fallbackProviders: ['coinbase'],
      maxRetries: 3,
      retryDelay: 5000,
    };
  }

  private async initializeProviders() {
    for (const providerConfig of this.config.providers) {
      let provider: MarketDataProvider;

      switch (providerConfig.name.toLowerCase()) {
        case 'binance':
          provider = new BinanceProvider({ url: providerConfig.url });
          break;
        case 'coinbase':
          provider = new CoinbaseProvider({ url: providerConfig.url });
          break;
        default:
          this.logger.warn(`Unknown provider: ${providerConfig.name}`);
          continue;
      }

      provider.onPriceUpdate((data) => this.handlePriceUpdate(data));
      this.providers.set(providerConfig.name, provider);

      if (!this.primaryProvider) {
        this.primaryProvider = provider;
      } else if (this.config.fallbackProviders.includes(providerConfig.name)) {
        this.fallbackProviders.push(provider);
      }
    }

    this.logger.log(`Initialized ${this.providers.size} market data providers`);
  }

  private async connectProviders() {
    const connectionPromises = Array.from(this.providers.values()).map(provider =>
      this.connectProviderWithRetry(provider)
    );

    await Promise.allSettled(connectionPromises);
  }

  private async connectProviderWithRetry(provider: MarketDataProvider, attempt = 1): Promise<void> {
    try {
      await provider.connect();
      const providerConfig = this.config.providers.find(p => p.name === provider.name);
      if (providerConfig) {
        await provider.subscribeToPairs(providerConfig.pairs);
      }
      this.logger.log(`Successfully connected to ${provider.name}`);
    } catch (error) {
      this.logger.error(`Failed to connect to ${provider.name} (attempt ${attempt}):`, error);
      
      if (attempt < this.config.maxRetries) {
        setTimeout(() => {
          this.connectProviderWithRetry(provider, attempt + 1);
        }, this.config.retryDelay);
      } else {
        this.logger.error(`Max connection attempts reached for ${provider.name}`);
      }
    }
  }

  private async disconnectAllProviders() {
    const disconnectPromises = Array.from(this.providers.values()).map(provider =>
      provider.disconnect().catch(error => 
        this.logger.error(`Error disconnecting ${provider.name}:`, error)
      )
    );

    await Promise.all(disconnectPromises);
  }

  private async handlePriceUpdate(data: PriceUpdate) {
    try {
      const validation = await this.validatorService.validateMarketData(data);
      
      if (!validation.isValid) {
        this.logger.warn(`Invalid market data from ${data.source}:`, validation.errors);
        return;
      }

      const sanitizedData = validation.sanitizedData!;
      
      if (!this.validatorService.validatePriceRange(sanitizedData.price, sanitizedData.symbol)) {
        return;
      }

      await this.updateMarketData(sanitizedData);
      await this.updateCache(data as any);

    } catch (error) {
      this.logger.error(`Error handling price update for ${data.symbol}:`, error);
    }
  }

  private async updateMarketData(data: any) {
    const existingRecord = await this.marketDataRepository.findOne({
      where: { asset: data.symbol }
    });

    if (existingRecord) {
      existingRecord.previousPrice = existingRecord.currentPrice;
      existingRecord.currentPrice = data.price;
      existingRecord.priceChange24h = data.price - existingRecord.previousPrice;
      existingRecord.updatedAt = new Date();
      
      await this.marketDataRepository.save(existingRecord);
    } else {
      const newRecord = this.marketDataRepository.create({
        asset: data.symbol,
        currentPrice: data.price,
        previousPrice: data.price,
        priceChange24h: 0,
        volume24h: data.volume || 0,
      });
      
      await this.marketDataRepository.save(newRecord);
    }
  }

  private async updateCache(data: any) {
    const cacheKey = `${this.cacheKeyPrefix}${data.symbol}`;
    await this.cacheService.set(cacheKey, data, this.cacheTTL);
  }

  async getMarketData(symbol?: string): Promise<MarketData[]> {
    if (symbol) {
      const cachedData = await this.cacheService.get(`${this.cacheKeyPrefix}${symbol}`);
      if (cachedData) {
        return [cachedData as MarketData];
      }

      const record = await this.marketDataRepository.findOne({
        where: { asset: symbol }
      });

      return record ? [record] : [];
    }

    return this.marketDataRepository.find({
      order: { updatedAt: 'DESC' }
    });
  }

  async getHistoricalData(symbol: string, fromDate: Date, toDate: Date): Promise<MarketData[]> {
    return this.marketDataRepository.find({
      where: {
        asset: symbol,
        updatedAt: {
          $gte: fromDate,
          $lte: toDate,
        } as any,
      },
      order: { updatedAt: 'ASC' },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async performHealthCheck() {
    for (const [name, provider] of this.providers) {
      if (!provider.isConnected()) {
        this.logger.warn(`Provider ${name} is disconnected, attempting reconnection...`);
        await this.connectProviderWithRetry(provider);
      }
    }
  }

  private startPeriodicUpdates() {
    setInterval(async () => {
      if (this.primaryProvider && !this.primaryProvider.isConnected()) {
        this.logger.warn('Primary provider is disconnected, trying fallback providers...');
        await this.tryFallbackProviders();
      }
    }, 30000);
  }

  private async tryFallbackProviders() {
    for (const provider of this.fallbackProviders) {
      if (provider.isConnected()) {
        this.logger.log(`Using fallback provider: ${provider.name}`);
        return;
      }
      
      try {
        await provider.connect();
        this.logger.log(`Successfully connected to fallback provider: ${provider.name}`);
        return;
      } catch (error) {
        this.logger.error(`Failed to connect to fallback provider ${provider.name}:`, error);
      }
    }
  }

  async subscribeToPairs(pairs: string[]): Promise<void> {
    const subscribePromises = Array.from(this.providers.values()).map(provider =>
      provider.subscribeToPairs(pairs).catch(error =>
        this.logger.error(`Failed to subscribe to pairs in ${provider.name}:`, error)
      )
    );

    await Promise.all(subscribePromises);
  }

  async unsubscribeFromPairs(pairs: string[]): Promise<void> {
    const unsubscribePromises = Array.from(this.providers.values()).map(provider =>
      provider.unsubscribeFromPairs(pairs).catch(error =>
        this.logger.error(`Failed to unsubscribe from pairs in ${provider.name}:`, error)
      )
    );

    await Promise.all(unsubscribePromises);
  }
}
