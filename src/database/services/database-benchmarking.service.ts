import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Trade } from '../entities/trade.entity';
import { UserBalance } from '../entities/user-balance.entity';
import { VirtualAsset } from '../entities/virtual-asset.entity';
import { OptimizedQueryService } from './optimized-query.service';
import { MultiLevelCacheService } from './multi-level-cache.service';
import { DatabaseLoadBalancerService } from './database-load-balancer.service';

export interface BenchmarkConfig {
  name: string;
  description: string;
  duration: number; // seconds
  concurrency: number;
  warmupDuration: number; // seconds
  scenarios: BenchmarkScenario[];
}

export interface BenchmarkScenario {
  name: string;
  weight: number; // relative frequency
  operation: () => Promise<any>;
  expectedLatency?: number; // milliseconds
  expectedThroughput?: number; // operations per second
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  errorRate: number;
  scenarioResults: ScenarioResult[];
  systemMetrics: SystemMetrics;
}

export interface ScenarioResult {
  scenarioName: string;
  operations: number;
  averageLatency: number;
  p95Latency: number;
  throughput: number;
  errorRate: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  databaseConnections: number;
  cacheHitRate: number;
  diskIO: number;
}

export interface LoadTestProfile {
  name: string;
  phases: LoadTestPhase[];
}

export interface LoadTestPhase {
  name: string;
  duration: number; // seconds
  targetRPS: number; // requests per second
  rampUpTime?: number; // seconds
  scenarios: string[];
}

@Injectable()
export class DatabaseBenchmarkingService {
  private readonly logger = new Logger(DatabaseBenchmarkingService.name);
  private isRunning = false;
  private currentBenchmark: BenchmarkResult | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly optimizedQueryService: OptimizedQueryService,
    private readonly cacheService: MultiLevelCacheService,
    private readonly loadBalancer: DatabaseLoadBalancerService,
  ) {}

  /**
   * Run comprehensive database benchmark
   */
  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    if (this.isRunning) {
      throw new Error('Benchmark is already running');
    }

    this.isRunning = true;
    this.logger.log(`Starting benchmark: ${config.name}`);

    const startTime = Date.now();
    const latencies: number[] = [];
    const scenarioMetrics = new Map<string, { latencies: number[]; errors: number; total: number }>();

    try {
      // Warmup phase
      if (config.warmupDuration > 0) {
        this.logger.log(`Starting warmup for ${config.warmupDuration} seconds`);
        await this.runWarmup(config, config.warmupDuration);
      }

      // Main benchmark phase
      this.logger.log(`Starting main benchmark for ${config.duration} seconds`);
      const endTime = Date.now() + config.duration * 1000;

      const results = await this.runBenchmarkPhase(config, endTime, latencies, scenarioMetrics);

      const systemMetrics = await this.collectSystemMetrics();

      const benchmarkResult: BenchmarkResult = {
        config,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: (Date.now() - startTime) / 1000,
        totalOperations: results.totalOperations,
        successfulOperations: results.successfulOperations,
        failedOperations: results.failedOperations,
        averageLatency: this.calculateAverage(latencies),
        p50Latency: this.calculatePercentile(latencies, 50),
        p95Latency: this.calculatePercentile(latencies, 95),
        p99Latency: this.calculatePercentile(latencies, 99),
        maxLatency: Math.max(...latencies),
        minLatency: Math.min(...latencies),
        throughput: results.successfulOperations / ((Date.now() - startTime) / 1000),
        errorRate: results.failedOperations / results.totalOperations * 100,
        scenarioResults: this.calculateScenarioResults(scenarioMetrics),
        systemMetrics,
      };

      this.currentBenchmark = benchmarkResult;
      this.logger.log(`Benchmark completed: ${JSON.stringify(benchmarkResult, null, 2)}`);

      return benchmarkResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run load test with varying phases
   */
  async runLoadTest(profile: LoadTestProfile): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const phase of profile.phases) {
      this.logger.log(`Starting load test phase: ${phase.name}`);

      const phaseConfig: BenchmarkConfig = {
        name: `${profile.name} - ${phase.name}`,
        description: `Load test phase: ${phase.name}`,
        duration: phase.duration,
        concurrency: Math.ceil(phase.targetRPS / 10), // Estimate concurrency
        warmupDuration: phase.rampUpTime || 30,
        scenarios: this.getScenariosByName(phase.scenarios),
      };

      const result = await this.runBenchmark(phaseConfig);
      results.push(result);

      // Brief pause between phases
      await this.delay(5000);
    }

    return results;
  }

  /**
   * Stress test to find breaking point
   */
  async runStressTest(baseConfig: Partial<BenchmarkConfig>): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    let concurrency = 10;
    const maxConcurrency = 1000;
    const incrementFactor = 2;

    while (concurrency <= maxConcurrency) {
      this.logger.log(`Running stress test with concurrency: ${concurrency}`);

      const config: BenchmarkConfig = {
        name: `Stress Test - Concurrency ${concurrency}`,
        description: `Stress test with ${concurrency} concurrent operations`,
        duration: 60, // 1 minute per test
        concurrency,
        warmupDuration: 30,
        scenarios: this.getDefaultScenarios(),
        ...baseConfig,
      };

      try {
        const result = await this.runBenchmark(config);
        results.push(result);

        // Stop if error rate is too high
        if (result.errorRate > 10) {
          this.logger.log(`Stopping stress test - error rate too high: ${result.errorRate}%`);
          break;
        }

        // Stop if latency is too high
        if (result.p95Latency > 5000) { // 5 seconds
          this.logger.log(`Stopping stress test - latency too high: ${result.p95Latency}ms`);
          break;
        }
      } catch (error) {
        this.logger.error(`Stress test failed at concurrency ${concurrency}:`, error);
        break;
      }

      concurrency *= incrementFactor;
      await this.delay(10000); // 10 second pause between tests
    }

    return results;
  }

  /**
   * Compare performance before and after optimization
   */
  async comparePerformance(
    beforeConfig: BenchmarkConfig,
    afterConfig: BenchmarkConfig,
  ): Promise<{ before: BenchmarkResult; after: BenchmarkResult; improvement: any }> {
    this.logger.log('Running performance comparison test');

    // Run before optimization
    const before = await this.runBenchmark(beforeConfig);

    // Wait for system to stabilize
    await this.delay(30000);

    // Run after optimization
    const after = await this.runBenchmark(afterConfig);

    const improvement = {
      latencyImprovement: ((before.averageLatency - after.averageLatency) / before.averageLatency) * 100,
      throughputImprovement: ((after.throughput - before.throughput) / before.throughput) * 100,
      errorRateImprovement: before.errorRate - after.errorRate,
      p95LatencyImprovement: ((before.p95Latency - after.p95Latency) / before.p95Latency) * 100,
    };

    return { before, after, improvement };
  }

  /**
   * Get predefined benchmark scenarios
   */
  getDefaultScenarios(): BenchmarkScenario[] {
    return [
      {
        name: 'user_trade_history',
        weight: 30,
        operation: async () => {
          const userId = Math.floor(Math.random() * 1000) + 1;
          return await this.optimizedQueryService.getUserTradeHistory(userId, 50);
        },
        expectedLatency: 50,
        expectedThroughput: 1000,
      },
      {
        name: 'market_data_aggregation',
        weight: 20,
        operation: async () => {
          const assets = ['BTC', 'ETH', 'USDT'];
          return await this.optimizedQueryService.getMarketDataAggregation(assets, '24h');
        },
        expectedLatency: 100,
        expectedThroughput: 500,
      },
      {
        name: 'portfolio_snapshot',
        weight: 25,
        operation: async () => {
          const userId = Math.floor(Math.random() * 1000) + 1;
          return await this.optimizedQueryService.getUserPortfolioSnapshot(userId);
        },
        expectedLatency: 75,
        expectedThroughput: 800,
      },
      {
        name: 'trading_statistics',
        weight: 15,
        operation: async () => {
          return await this.optimizedQueryService.getTradingStatistics('5m');
        },
        expectedLatency: 30,
        expectedThroughput: 2000,
      },
      {
        name: 'top_traders',
        weight: 10,
        operation: async () => {
          return await this.optimizedQueryService.getTopTraders(100, '24h');
        },
        expectedLatency: 200,
        expectedThroughput: 300,
      },
    ];
  }

  /**
   * Get scenarios by name
   */
  private getScenariosByName(names: string[]): BenchmarkScenario[] {
    const allScenarios = this.getDefaultScenarios();
    return names.map(name => 
      allScenarios.find(s => s.name === name) || 
      { name, weight: 1, operation: async () => {} }
    );
  }

  /**
   * Run warmup phase
   */
  private async runWarmup(config: BenchmarkConfig, duration: number): Promise<void> {
    const endTime = Date.now() + duration * 1000;
    const concurrency = Math.min(config.concurrency, 10); // Lower concurrency for warmup

    while (Date.now() < endTime) {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < concurrency; i++) {
        const scenario = this.selectRandomScenario(config.scenarios);
        promises.push(this.executeScenario(scenario));
      }
      await Promise.allSettled(promises);
      await this.delay(100); // Small delay between batches
    }
  }

  /**
   * Run main benchmark phase
   */
  private async runBenchmarkPhase(
    config: BenchmarkConfig,
    endTime: number,
    latencies: number[],
    scenarioMetrics: Map<string, { latencies: number[]; errors: number; total: number }>,
  ): Promise<{ totalOperations: number; successfulOperations: number; failedOperations: number }> {
    let totalOperations = 0;
    let successfulOperations = 0;
    let failedOperations = 0;

    while (Date.now() < endTime) {
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < config.concurrency; i++) {
        const scenario = this.selectRandomScenario(config.scenarios);
        promises.push(this.executeScenarioWithMetrics(scenario, latencies, scenarioMetrics));
      }

      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        totalOperations++;
        if (result.status === 'fulfilled') {
          successfulOperations++;
        } else {
          failedOperations++;
        }
      });

      // Small delay to prevent overwhelming the system
      await this.delay(10);
    }

    return { totalOperations, successfulOperations, failedOperations };
  }

  /**
   * Execute scenario and record metrics
   */
  private async executeScenarioWithMetrics(
    scenario: BenchmarkScenario,
    latencies: number[],
    scenarioMetrics: Map<string, { latencies: number[]; errors: number; total: number }>,
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await this.executeScenario(scenario);
      const latency = Date.now() - startTime;
      
      latencies.push(latency);
      
      // Record scenario-specific metrics
      if (!scenarioMetrics.has(scenario.name)) {
        scenarioMetrics.set(scenario.name, { latencies: [], errors: 0, total: 0 });
      }
      
      const metrics = scenarioMetrics.get(scenario.name)!;
      metrics.latencies.push(latency);
      metrics.total++;
      
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      latencies.push(latency);
      
      // Record error
      if (!scenarioMetrics.has(scenario.name)) {
        scenarioMetrics.set(scenario.name, { latencies: [], errors: 0, total: 0 });
      }
      
      const metrics = scenarioMetrics.get(scenario.name)!;
      metrics.latencies.push(latency);
      metrics.errors++;
      metrics.total++;
      
      throw error;
    }
  }

  /**
   * Execute a single scenario
   */
  private async executeScenario(scenario: BenchmarkScenario): Promise<any> {
    return await scenario.operation();
  }

  /**
   * Select random scenario based on weights
   */
  private selectRandomScenario(scenarios: BenchmarkScenario[]): BenchmarkScenario {
    const totalWeight = scenarios.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const scenario of scenarios) {
      random -= scenario.weight;
      if (random <= 0) {
        return scenario;
      }
    }
    
    return scenarios[0];
  }

  /**
   * Calculate scenario results
   */
  private calculateScenarioResults(
    scenarioMetrics: Map<string, { latencies: number[]; errors: number; total: number }>,
  ): ScenarioResult[] {
    const results: ScenarioResult[] = [];
    
    for (const [scenarioName, metrics] of scenarioMetrics) {
      results.push({
        scenarioName,
        operations: metrics.total,
        averageLatency: this.calculateAverage(metrics.latencies),
        p95Latency: this.calculatePercentile(metrics.latencies, 95),
        throughput: metrics.total / (this.currentBenchmark?.duration || 1),
        errorRate: (metrics.errors / metrics.total) * 100,
      });
    }
    
    return results;
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    
    return {
      cpuUsage: 0, // Would need a library like 'os-utils'
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      databaseConnections: 1, // Simplified
      cacheHitRate: this.cacheService.getMetrics().overallHitRate,
      diskIO: 0, // Would need platform-specific implementation
    };
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current benchmark status
   */
  getCurrentBenchmark(): BenchmarkResult | null {
    return this.currentBenchmark;
  }

  /**
   * Check if benchmark is running
   */
  isBenchmarkRunning(): boolean {
    return this.isRunning;
  }
}