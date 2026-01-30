import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheWarmingService } from './cache-warming.service';
import { CacheService } from '../services/cache.service';
import type { CacheWarmingMetrics, CacheHitMissMetrics } from './interfaces/cache-warming.interface';

@ApiTags('Cache')
@Controller('cache')
export class CacheController {
  constructor(
    private readonly cacheWarmingService: CacheWarmingService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('warming/metrics')
  @ApiOperation({ summary: 'Get cache warming metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache warming metrics retrieved successfully',
    type: Object
  })
  getWarmingMetrics(): CacheWarmingMetrics {
    return this.cacheWarmingService.getWarmingMetrics();
  }

  @Get('warming/status')
  @ApiOperation({ summary: 'Get cache warming status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache warming status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isWarming: { type: 'boolean' },
        warmingMetrics: { type: 'object' }
      }
    }
  })
  getWarmingStatus(): { isWarming: boolean; warmingMetrics: CacheWarmingMetrics } {
    return {
      isWarming: this.cacheWarmingService.isCurrentlyWarming(),
      warmingMetrics: this.cacheWarmingService.getWarmingMetrics()
    };
  }

  @Post('warming/force')
  @ApiOperation({ summary: 'Force cache warming' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache warming initiated successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Cache warming is already in progress'
  })
  async forceWarmCache(): Promise<CacheWarmingMetrics> {
    return await this.cacheWarmingService.forceWarmCache();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get cache hit/miss metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache metrics retrieved successfully',
    type: Object
  })
  getCacheMetrics(): CacheHitMissMetrics {
    return this.cacheService.getCacheMetrics();
  }

  @Post('metrics/reset')
  @ApiOperation({ summary: 'Reset cache metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache metrics reset successfully'
  })
  resetMetrics(): { message: string } {
    this.cacheService.resetMetrics();
    return { message: 'Cache metrics reset successfully' };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get cache health status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache health status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        warmingEnabled: { type: 'boolean' },
        isWarming: { type: 'boolean' }
      }
    }
  })
  async getCacheHealth(): Promise<any> {
    try {
      const cacheManager = this.cacheService.getCacheManager();
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'test-value';
      
      await cacheManager.set(testKey, testValue, 10);
      const result = await cacheManager.get(testKey);
      
      const status = result === testValue ? 'healthy' : 'degraded';
      const message = result === testValue 
        ? 'Cache is responding correctly' 
        : 'Cache is responding but values not matching';
      
      return {
        status,
        message,
        warmingEnabled: true, // This would come from config
        isWarming: this.cacheWarmingService.isCurrentlyWarming()
      };
    } catch (error) {
      return {
        status: 'unavailable',
        message: `Cache is unavailable: ${error.message}`,
        warmingEnabled: false,
        isWarming: false
      };
    }
  }
}