import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheStatisticsService } from '../services/cache-statistics.service';
import { CacheWarmingService } from '../services/cache-warming-advanced.service';
import { CacheService } from '../services/cache.service';

@ApiTags('cache-management')
@Controller('api/cache')
export class CacheManagementController {
  private readonly logger = new Logger(CacheManagementController.name);

  constructor(
    private readonly cacheStats: CacheStatisticsService,
    private readonly cacheWarming: CacheWarmingService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get cache statistics
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get cache performance statistics',
    description: 'Returns cache hit/miss ratio, error counts, and key-level stats',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  getStatistics() {
    const stats = this.cacheStats.getStatistics();
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get statistics for top cache keys
   */
  @Get('statistics/top-keys')
  @ApiOperation({
    summary: 'Get top performing cache keys',
    description: 'Returns the cache keys with the highest hit counts',
  })
  @ApiResponse({
    status: 200,
    description: 'Top cache keys retrieved successfully',
  })
  getTopCacheKeys(@Query('limit') limit: string = '10') {
    const topKeys = this.cacheStats.getTopCacheKeys(parseInt(limit, 10));
    return {
      success: true,
      data: topKeys,
      count: topKeys.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get statistics for a specific cache key
   */
  @Get('statistics/key/:key')
  @ApiOperation({
    summary: 'Get statistics for a specific cache key',
    description: 'Returns hit/miss counts for a specific key',
  })
  @ApiResponse({
    status: 200,
    description: 'Key statistics retrieved successfully',
  })
  getKeyStatistics(@Param('key') key: string) {
    const stats = this.cacheStats.getKeyStatistics(key);
    return {
      success: true,
      data: {
        key,
        ...stats,
        hitRatio: stats.hits / (stats.hits + stats.misses) || 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset cache statistics
   */
  @Post('statistics/reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset cache statistics',
    description: 'Clears all collected cache statistics',
  })
  @ApiResponse({ status: 200, description: 'Statistics reset successfully' })
  resetStatistics() {
    this.cacheStats.resetStatistics();
    this.logger.log('Cache statistics reset');
    return {
      success: true,
      message: 'Cache statistics reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache warming tasks status
   */
  @Get('warming/tasks')
  @ApiOperation({
    summary: 'Get cache warming task status',
    description: 'Returns status of all cache warming tasks',
  })
  @ApiResponse({ status: 200, description: 'Warming tasks retrieved' })
  getWarmingTasks() {
    const tasks = this.cacheWarming.getTasks();
    return {
      success: true,
      data: tasks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually trigger cache warming
   */
  @Post('warming/trigger')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manually trigger cache warming',
    description: 'Immediately starts cache warming process',
  })
  @ApiResponse({ status: 200, description: 'Cache warming triggered' })
  async triggerWarming(@Query('task') taskName?: string) {
    this.logger.log(`Triggering cache warming${taskName ? ` for task: ${taskName}` : ''}`);
    await this.cacheWarming.triggerWarming(taskName);
    return {
      success: true,
      message: 'Cache warming triggered successfully',
      task: taskName || 'full_warming',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Enable/disable a warming task
   */
  @Post('warming/task/:taskName/:action')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Enable or disable a warming task',
    description: 'Enable or disable a specific cache warming task',
  })
  @ApiResponse({ status: 200, description: 'Task state updated' })
  setTaskState(
    @Param('taskName') taskName: string,
    @Param('action') action: 'enable' | 'disable',
  ) {
    const enabled = action === 'enable';
    this.cacheWarming.setTaskEnabled(taskName, enabled);
    return {
      success: true,
      message: `Task '${taskName}' ${enabled ? 'enabled' : 'disabled'}`,
      taskName,
      enabled,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Flush entire cache
   */
  @Post('flush')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Flush entire cache',
    description: 'Clears all cached data (use with caution)',
  })
  @ApiResponse({ status: 200, description: 'Cache flushed successfully' })
  async flushCache() {
    this.logger.warn('Cache flush requested');
    await this.cacheService.flush();
    return {
      success: true,
      message: 'Cache flushed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache health status
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get cache health status',
    description: 'Returns overall cache health and performance metrics',
  })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  getHealth() {
    const stats = this.cacheStats.getStatistics();
    const isHealthy =
      stats.hitRatio >= 0.7 && stats.errors < stats.totalRequests * 0.05;

    return {
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        hitRatio: `${(stats.hitRatio * 100).toFixed(2)}%`,
        totalRequests: stats.totalRequests,
        hits: stats.hits,
        misses: stats.misses,
        errors: stats.errors,
        errorRate: `${((stats.errors / stats.totalRequests) * 100).toFixed(2)}%`,
        recommendations: this.getHealthRecommendations(stats),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Private: Generate health recommendations
   */
  private getHealthRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.hitRatio < 0.5) {
      recommendations.push('Cache hit ratio is low. Consider increasing TTL values.');
    }

    if (stats.hitRatio < 0.7) {
      recommendations.push('Cache hit ratio below 70%. Consider warming cache more frequently.');
    }

    if (stats.errors > stats.totalRequests * 0.1) {
      recommendations.push('High error rate in cache operations. Check Redis connectivity.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache is performing well. No immediate actions needed.');
    }

    return recommendations;
  }
}
