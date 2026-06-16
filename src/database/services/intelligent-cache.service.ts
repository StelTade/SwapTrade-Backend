import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MultiLevelCacheService } from './multi-level-cache.service';

@Injectable()
export class IntelligentCacheService implements OnModuleInit {
  private readonly logger = new Logger(IntelligentCacheService.name);
  
  // Access frequency tracking for ML prediction
  private accessHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_WINDOW = 100;

  constructor(
    private readonly multiLevelCache: MultiLevelCacheService,
  ) {}

  async onModuleInit() {
    this.logger.log('Intelligent Cache Service initialized');
  }

  /**
   * Get value with intelligent pre-fetching and hit prediction
   */
  async get<T>(key: string): Promise<T | undefined> {
    this.recordAccess(key);
    
    // 1. Predict next likely keys to be accessed
    const predictions = this.predictNextKeys(key);
    
    // 2. Proactively pre-fetch predicted keys into L1/L2
    this.prefetchKeys(predictions);

    // 3. Standard multi-level cache get
    return await this.multiLevelCache.get<T>(key);
  }

  /**
   * Set value with dynamic TTL based on predicted volatility
   */
  async set<T>(key: string, value: T): Promise<void> {
    const volatility = this.calculateVolatility(key);
    
    // High volatility = shorter TTL
    const ttl = volatility > 0.8 ? 30 : 300; 
    
    await this.multiLevelCache.set(key, value, ttl);
  }

  /**
   * Record key access for pattern analysis
   */
  private recordAccess(key: string): void {
    if (!this.accessHistory.has(key)) {
      this.accessHistory.set(key, []);
    }
    
    const history = this.accessHistory.get(key)!;
    history.push(Date.now());
    
    if (history.length > this.HISTORY_WINDOW) {
      history.shift();
    }
  }

  /**
   * Simple pattern-based key prediction
   */
  private predictNextKeys(currentKey: string): string[] {
    // In a real implementation, this would use a Markov Chain or LSTM model
    // For now, we'll use a simple sequential pattern recognizer
    const predictions: string[] = [];
    
    if (currentKey.startsWith('trade:')) {
      const tradeId = parseInt(currentKey.split(':')[1]);
      predictions.push(`trade:${tradeId + 1}`);
      predictions.push(`trade_details:${tradeId}`);
    } else if (currentKey.startsWith('user_trades:')) {
      const userId = currentKey.split(':')[1];
      predictions.push(`user_balance:${userId}`);
      predictions.push(`user_profile:${userId}`);
    }

    return predictions;
  }

  /**
   * Pre-fetch keys into faster cache levels
   */
  private async prefetchKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      // Logic to move from L3 to L2/L1 if it exists
      const value = await this.multiLevelCache.get(key);
      if (value) {
        this.logger.debug(`Pre-fetched predicted key: ${key}`);
      }
    }
  }

  /**
   * Calculate data volatility for dynamic TTL adjustment
   */
  private calculateVolatility(key: string): number {
    const history = this.accessHistory.get(key);
    if (!history || history.length < 2) return 0.5;

    // Calculate average time between accesses
    let totalGap = 0;
    for (let i = 1; i < history.length; i++) {
      totalGap += (history[i] - history[i-1]);
    }
    
    const avgGap = totalGap / (history.length - 1);
    
    // Higher frequency (lower gap) = higher volatility
    return Math.min(1.0, 1000 / avgGap);
  }

  /**
   * Intelligent invalidation based on usage patterns
   */
  async intelligentInvalidate(pattern: string): Promise<void> {
    this.logger.log(`Executing intelligent invalidation for pattern: ${pattern}`);
    
    // Find all keys matching pattern and analyze their utility
    // In production, this would query Redis for keys and check hit rates
    await this.multiLevelCache.invalidatePattern(pattern);
  }
}