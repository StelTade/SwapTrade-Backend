import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, Repository } from 'typeorm';
import { TradeEntity } from './entities/trade.entity';
import { PortfolioRepository } from './portfolio.repository';
import { PortfolioAnalytics } from '../common/interfaces/portfolio.interface';
import { Balance } from '../balance/balance.entity';
import { Trade } from '../trading/entities/trade.entity';
import {
  AssetAllocation,
  PortfolioSummaryDto,
} from './dto/portfolio-summary.dto';
import { PortfolioRiskDto } from './dto/portfolio-risk.dto';
import {
  AssetPerformance,
  PortfolioPerformanceDto,
} from './dto/portfolio-performance.dto';
import { TradeType } from '../common/enums/trade-type.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../common/services/cache.service';
import { RiskAnalyticsService } from './services/risk-analytics.service';

interface MarketPrice {
  price: number;
  timestamp: Date;
}

interface CostBasisData {
  totalCost: number;
  totalQuantity: number;
  averagePrice: number;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);
  private readonly priceCache = new Map<string, MarketPrice>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes


  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    private readonly portfolioRepository: PortfolioRepository,
    private readonly cacheService: CacheService,
    private readonly riskAnalyticsService: RiskAnalyticsService,
  ) {}

  private readonly PORTFOLIO_CACHE_TTL = 60; // 1 minute
  private readonly ANALYTICS_CACHE_TTL = 120; // 2 minutes (as per requirement)

  /**
   * Get analytics for a user's portfolio.
   * 
   * OPTIMIZED VERSION:
   * - Uses QueryBuilder aggregation instead of N+1 queries
   * - Single consolidated database query
   * - Caches results with 2-minute TTL
   * - Performs efficiently even with 10k+ trades
   * 
   * Metrics calculated:
   * - Profit & Loss (PnL)
   * - Asset distribution (percentages)
   * - Risk score (standard deviation of allocations)
   */
  async getAnalytics(userId: string): Promise<PortfolioAnalytics> {
    const cacheKey = `portfolio:analytics:${userId}`;
    const startTime = Date.now();

    // Try to get from cache first
    try {
      const cached = await this.cacheService.get<PortfolioAnalytics>(cacheKey);
      if (cached) {
        this.logger.log(
          `Portfolio analytics retrieved from cache for userId: ${userId}`,
        );
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        `Cache read failed for analytics: ${error.message}, falling back to database`,
      );
    }

    // Fetch analytics using optimized aggregation query
    const analytics =
      await this.portfolioRepository.getPortfolioAnalyticsAggregated(userId);

    const queryTime = Date.now() - startTime;
    this.logger.log(
      `Portfolio analytics calculated in ${queryTime}ms with aggregation query`,
    );

    // Cache the result with 2-minute TTL (120 seconds)
    try {
      await this.cacheService.set(
        cacheKey,
        analytics,
        this.ANALYTICS_CACHE_TTL, // TTL in seconds
      );
      this.logger.debug(
        `Analytics cached for ${this.ANALYTICS_CACHE_TTL}s (userId: ${userId})`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to cache analytics: ${error.message}, operation continues without cache`,
      );
    }

    return analytics;
  }
  async getPortfolioSummary(userId: string): Promise<PortfolioSummaryDto> {
    try {
      // Try to get from cache first
      const cached = await this.cacheService.getPortfolioCache(userId);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // If cache is unavailable, log and fall back to database
      console.warn('Cache unavailable, falling back to database:', error.message);
    }

    const startTime = Date.now();

    const balances = await this.balanceRepository.find({
      where: { userId },
      relations: ['asset'],
    });

    if (balances.length === 0) {
      const result = {
        totalValue: 0,
        assets: [],
        count: 0,
        timestamp: new Date().toISOString(),
        pricesFetchedAt: new Date().toISOString(),
      };
      
      try {
        // Cache the empty result
        await this.cacheService.setPortfolioCache(userId, result);
      } catch (error) {
        // If cache fails, log but don't fail the operation
        console.warn('Failed to cache result:', error.message);
      }
      
      return result;
    }

    const pricesFetchedAt = new Date();
    const assets: AssetAllocation[] = [];
    let totalValue = 0;

    // Calculate values for each asset
    for (const balance of balances) {
      if (balance.available <= 0) continue;

      const currentPrice = await this.getMarketPrice(balance.asset);
      const value = balance.available * currentPrice;
      const costBasis = await this.getCostBasis(userId, balance.asset);

      totalValue += value;

      assets.push({
        symbol: balance.asset,
        name: balance.asset,
        value,
        quantity: balance.available,
        averagePrice: costBasis.averagePrice,
        allocationPercentage: 0, // Will calculate after we have total
      });
    }

    // Calculate allocation percentages
    assets.forEach((asset) => {
      asset.allocationPercentage =
        totalValue > 0
          ? Number(((asset.value / totalValue) * 100).toFixed(2))
          : 0;
    });

    // Sort by value descending
    assets.sort((a, b) => b.value - a.value);

    const duration = Date.now() - startTime;
    this.logger.log(`Portfolio summary calculated in ${duration}ms`);

    const result = {
      totalValue: Number(totalValue.toFixed(2)),
      assets,
      count: assets.length,
      timestamp: new Date().toISOString(),
      pricesFetchedAt: pricesFetchedAt.toISOString(),
    };
    
    try {
      // Cache the result
      await this.cacheService.setPortfolioCache(userId, result);
    } catch (error) {
      // If cache fails, log but don't fail the operation
      console.warn('Failed to cache result:', error.message);
    }
    
    return result;
  }

  async getPortfolioRisk(userId: string): Promise<PortfolioRiskDto> {
    const startTime = Date.now();

    const summary = await this.getPortfolioSummary(userId.toString());

    if (summary.count === 0) {
      return {
        concentrationRisk: 0,
        diversificationScore: 0,
        volatilityEstimate: 0,
        valueAtRisk: { parametric: 0, historical: 0, confidenceLevel: 95 },
        conditionalValueAtRisk: 0,
        stressTestResults: [],
        timestamp: new Date().toISOString(),
        metadata: {
          largestHolding: '',
          largestHoldingPercentage: 0,
          herfindahlIndex: 0,
          effectiveAssets: 0,
        },
      };
    }

    // Concentration risk: percentage in largest holding
    const largestHolding = summary.assets[0];
    const concentrationRisk =
      summary.count === 1 ? 100 : largestHolding.allocationPercentage;

    // Herfindahl-Hirschman Index (HHI)
    // Sum of squared allocation percentages
    const herfindahlIndex = summary.assets.reduce(
      (sum, asset) => sum + Math.pow(asset.allocationPercentage / 100, 2),
      0,
    );

    // Effective number of assets (1/HHI)
    const effectiveAssets = herfindahlIndex > 0 ? 1 / herfindahlIndex : 0;

    // Diversification score (0-100, higher is better)
    // Normalize HHI: perfect diversification (n assets equally weighted) = 1/n
    // Single asset = 1, many assets = approaching 0
    // Score = (1 - HHI) * 100, adjusted for portfolio size
    const maxDiversification = summary.count > 1 ? 1 - 1 / summary.count : 0;
    const actualDiversification = 1 - herfindahlIndex;
    const diversificationScore =
      maxDiversification > 0
        ? Number(
            ((actualDiversification / maxDiversification) * 100).toFixed(1),
          )
        : 0;

    // Volatility estimate: weighted average of asset volatilities
    const portfolioVolatility = this.riskAnalyticsService.calculatePortfolioVolatility(summary.assets);

    // Calculate VaR (95% confidence, 1 day)
    const parametricVaR = this.riskAnalyticsService.calculateParametricVaR(summary.totalValue, portfolioVolatility, 95);
    
    // Calculate CVaR
    const cvar = this.riskAnalyticsService.calculateCVaR(summary.totalValue, portfolioVolatility, 95);

    // Perform Stress Tests
    const stressTestResults = this.riskAnalyticsService.performStressTests(summary.totalValue, summary.assets);

    // Simulated Historical VaR (would require DB history in production)
    const historicalVaR = parametricVaR * 1.05; // Usually slightly higher than parametric in crypto

    // Normalize volatility to 0-100 scale (assuming max 100% volatility)
    const volatilityEstimate = Number(
      Math.min(100, portfolioVolatility).toFixed(1),
    );

    const duration = Date.now() - startTime;
    this.logger.log(`Portfolio risk calculated in ${duration}ms`);

    return {
      concentrationRisk: Number(concentrationRisk.toFixed(1)),
      diversificationScore,
      volatilityEstimate,
      valueAtRisk: {
        parametric: parametricVaR,
        historical: Number(historicalVaR.toFixed(2)),
        confidenceLevel: 95
      },
      conditionalValueAtRisk: cvar,
      stressTestResults,
      timestamp: new Date().toISOString(),
      metadata: {
        largestHolding: largestHolding.symbol,
        largestHoldingPercentage: Number(concentrationRisk.toFixed(2)),
        herfindahlIndex: Number(herfindahlIndex.toFixed(4)),
        effectiveAssets: Number(effectiveAssets.toFixed(2)),
      },
    };
  }

  async getPortfolioPerformance(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<PortfolioPerformanceDto> {
    const startTime = Date.now();

    const balances = await this.balanceRepository.find({
      where: { userId },
      relations: ['asset'],
    });

    if (balances.length === 0) {
      return {
        totalGain: 0,
        totalLoss: 0,
        roi: 0,
        totalCostBasis: 0,
        totalCurrentValue: 0,
        netGain: 0,
        assetPerformance: [],
        timestamp: new Date().toISOString(),
        startDate,
        endDate,
      };
    }

    const assetPerformance: AssetPerformance[] = [];
    let totalCostBasis = 0;
    let totalCurrentValue = 0;

    for (const balance of balances) {
      if (balance.available <= 0) continue;

      const currentPrice = await this.getMarketPrice(balance.asset);
      const currentValue = balance.available * currentPrice;

      const costBasis = await this.getCostBasis(
        userId,
        balance.asset,
        startDate,
        endDate,
      );

      const totalCost = costBasis.totalCost;
      const gainLoss = currentValue - totalCost;

      totalCostBasis += totalCost;
      totalCurrentValue += currentValue;

      assetPerformance.push({
        symbol: balance.asset,
        totalGain: gainLoss > 0 ? Number(gainLoss.toFixed(2)) : 0,
        totalLoss: gainLoss < 0 ? Number(Math.abs(gainLoss).toFixed(2)) : 0,
        roi:
          totalCost > 0 ? Number(((gainLoss / totalCost) * 100).toFixed(2)) : 0,
        costBasis: Number(totalCost.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
      });
    }

    const netGain = totalCurrentValue - totalCostBasis;
    const totalGain = assetPerformance.reduce((sum, a) => sum + a.totalGain, 0);
    const totalLoss = assetPerformance.reduce((sum, a) => sum + a.totalLoss, 0);
    const roi =
      totalCostBasis > 0
        ? Number(((netGain / totalCostBasis) * 100).toFixed(2))
        : 0;

    const duration = Date.now() - startTime;
    this.logger.log(`Portfolio performance calculated in ${duration}ms`);

    return {
      totalGain: Number(totalGain.toFixed(2)),
      totalLoss: Number(totalLoss.toFixed(2)),
      roi,
      totalCostBasis: Number(totalCostBasis.toFixed(2)),
      totalCurrentValue: Number(totalCurrentValue.toFixed(2)),
      netGain: Number(netGain.toFixed(2)),
      assetPerformance: assetPerformance.sort(
        (a, b) => b.currentValue - a.currentValue,
      ),
      timestamp: new Date().toISOString(),
      startDate,
      endDate,
    };
  }

  private async getMarketPrice(symbol: string): Promise<number> {
    try {
      // Try to get from cache first
      const cached = await this.cacheService.getMarketPriceCache(symbol);
      if (cached) {
        return cached.price;
      }
    } catch (error) {
      // If cache is unavailable, log and fall back to database
      console.warn('Cache unavailable for market price, falling back to simulated price:', error.message);
    }

    // Simulate fetching from market API
    // In production, this would call an external price API
    const price = this.simulateMarketPrice(symbol);
    
    const marketPriceData = {
      price,
      timestamp: new Date().toISOString(),
    };
    
    try {
      // Cache the result with 5-minute TTL
      await this.cacheService.setMarketPriceCache(symbol, marketPriceData);
    } catch (error) {
      // If cache fails, log but don't fail the operation
      console.warn('Failed to cache market price:', error.message);
    }

    return price;
  }

  private simulateMarketPrice(symbol: string): number {
    // Mock prices for demonstration
    const prices: Record<string, number> = {
      BTC: 45000,
      ETH: 3000,
      USDT: 1,
      USDC: 1,
      BNB: 350,
      SOL: 100,
      XRP: 0.6,
      ADA: 0.5,
    };

    return prices[symbol] || 100;
  }

  private async getCostBasis(
    userId: string,
    symbol: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CostBasisData> {
    const whereCondition: any = {
      userId,
      symbol,
      status: 'completed',
    };

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      if (startDate && endDate) {
        whereCondition.createdAt = Between(
          new Date(startDate),
          new Date(endDate),
        );
      } else if (startDate) {
        whereCondition.createdAt = LessThanOrEqual(new Date());
      }
    }

    const trades = await this.tradeRepository.find({
      where: whereCondition,
      order: { timestamp: 'ASC' },
    });

    let totalCost = 0;
    let totalQuantity = 0;

    for (const trade of trades) {
      if (trade.type === TradeType.BUY) {
        totalCost += trade.quantity * trade.price;
        totalQuantity += trade.quantity;
      } else if (trade.type === TradeType.SELL) {
        // FIFO: reduce cost basis proportionally
        const soldProportion =
          totalQuantity > 0 ? trade.quantity / totalQuantity : 0;
        totalCost -= totalCost * soldProportion;
        totalQuantity -= trade.quantity;
      }
    }

    return {
      totalCost: Math.max(0, totalCost),
      totalQuantity: Math.max(0, totalQuantity),
      averagePrice: totalQuantity > 0 ? totalCost / totalQuantity : 0,
    };
  }

  // Helper method to clear price cache (useful for testing)
  clearPriceCache(): void {
    this.priceCache.clear();
  }
}
