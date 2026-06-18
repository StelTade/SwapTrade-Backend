import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import { OptimizedQueryService } from './services/optimized-query.service';
import { MultiLevelCacheService } from './services/multi-level-cache.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { DatabaseBenchmarkingService } from './services/database-benchmarking.service';
import { DatabaseMigrationService } from './services/database-migration.service';

@Controller('database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly optimizedQueryService: OptimizedQueryService,
    private readonly cacheService: MultiLevelCacheService,
    private readonly monitoringService: PerformanceMonitoringService,
    private readonly benchmarkingService: DatabaseBenchmarkingService,
    private readonly migrationService: DatabaseMigrationService,
  ) {}

  @Get()
  async getStatus() {
    return { status: 'Database controller is running' };
  }

  @Post('seed')
  async seedDatabase() {
    return await this.databaseService.seed();
  }

  // Performance Monitoring Endpoints
  @Get('metrics')
  async getMetrics() {
    return {
      current: this.monitoringService.getCurrentMetrics(),
      cache: this.cacheService.getMetrics(),
      health: await this.monitoringService.getShardHealth(),
    };
  }

  @Get('alerts')
  async getAlerts() {
    return {
      active: this.monitoringService.getActiveAlerts(),
      all: this.monitoringService.getAllAlerts(),
    };
  }

  @Post('alerts/:alertId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('alertId') alertId: string) {
    this.monitoringService.resolveAlert(alertId);
    return { message: 'Alert resolved successfully' };
  }

  // Query Optimization Endpoints
  @Get('queries/user/:userId/trades')
  async getUserTrades(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('asset') asset?: string,
  ) {
    return await this.optimizedQueryService.getUserTradeHistory(
      parseInt(userId),
      limit ? parseInt(limit) : 50,
      cursor,
      asset,
    );
  }

  @Get('queries/market/aggregation')
  async getMarketAggregation(
    @Query('assets') assets: string,
    @Query('timeWindow') timeWindow: '1h' | '24h' | '7d' = '24h',
  ) {
    const assetList = assets ? assets.split(',') : ['BTC', 'ETH', 'USDT'];
    return await this.optimizedQueryService.getMarketDataAggregation(
      assetList,
      timeWindow,
    );
  }

  @Get('queries/portfolio/:userId')
  async getUserPortfolio(@Param('userId') userId: string) {
    return await this.optimizedQueryService.getUserPortfolioSnapshot(
      parseInt(userId),
    );
  }

  @Get('queries/statistics')
  async getTradingStatistics(
    @Query('timeWindow') timeWindow: '1m' | '5m' | '15m' | '1h' = '5m',
  ) {
    return await this.optimizedQueryService.getTradingStatistics(timeWindow);
  }

  @Get('queries/top-traders')
  async getTopTraders(
    @Query('limit') limit?: string,
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ) {
    return await this.optimizedQueryService.getTopTraders(
      limit ? parseInt(limit) : 100,
      period,
    );
  }

  // Cache Management Endpoints
  @Get('cache/metrics')
  async getCacheMetrics() {
    return this.cacheService.getMetrics();
  }

  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidateCache(@Body('pattern') pattern: string) {
    await this.cacheService.invalidatePattern(pattern || '*');
    return { message: 'Cache invalidated successfully' };
  }

  @Post('cache/warmup')
  @HttpCode(HttpStatus.OK)
  async warmupCache() {
    await this.cacheService.warmupCriticalCache();
    return { message: 'Cache warmup completed' };
  }

  @Get('cache/health')
  async getCacheHealth() {
    return await this.cacheService.healthCheck();
  }

  // Benchmarking Endpoints
  @Post('benchmark/run')
  async runBenchmark(@Body() config: any) {
    return await this.benchmarkingService.runBenchmark(config);
  }

  @Get('benchmark/status')
  async getBenchmarkStatus() {
    return {
      isRunning: this.benchmarkingService.isBenchmarkRunning(),
      current: this.benchmarkingService.getCurrentBenchmark(),
    };
  }

  @Post('benchmark/stress-test')
  async runStressTest(@Body() config: any) {
    return await this.benchmarkingService.runStressTest(config);
  }

  // Migration Endpoints
  @Get('migration/plans')
  async getMigrationPlans() {
    return this.migrationService.getMigrationPlans();
  }

  @Post('migration/:planId/execute')
  async executeMigration(
    @Param('planId') planId: string,
    @Body() options: { dryRun?: boolean; skipValidation?: boolean },
  ) {
    return await this.migrationService.executeMigrationPlan(planId, options);
  }

  @Get('migration/:planId/progress')
  async getMigrationProgress(@Param('planId') planId: string) {
    return this.migrationService.getMigrationProgress(planId);
  }

  @Post('migration/backup')
  async createBackup(@Body('backupName') backupName: string) {
    return await this.migrationService.createDataBackup(backupName);
  }

  @Get('migration/:planId/report')
  async getMigrationReport(@Param('planId') planId: string) {
    return await this.migrationService.generateMigrationReport(planId);
  }

  // Health Check Endpoint
  @Get('health')
  async getHealthCheck() {
    const health = await this.optimizedQueryService.getQueryPerformanceHealth();
    const cacheHealth = await this.cacheService.healthCheck();

    return {
      status:
        health.status === 'healthy' && cacheHealth.status === 'healthy'
          ? 'healthy'
          : 'degraded',
      database: health,
      cache: cacheHealth,
      timestamp: new Date(),
    };
  }
}
