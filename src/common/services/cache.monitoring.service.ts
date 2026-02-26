import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Logger } from '@nestjs/common';

@Injectable()
export class CacheMonitoringService {
  private readonly logger = new Logger(CacheMonitoringService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    memoryUsage: number;
  }> {
    // Note: cache-manager-redis-store doesn't provide direct metrics
    // This is a simplified implementation
    
    // For Redis, we can get info directly
    if ('store' in this.cacheManager) {
      const store: any = this.cacheManager['store'];
      if (store && typeof store.getClient === 'function') {
        const client = store.getClient();
        if (client && typeof client.info === 'function') {
          try {
            const info = await client.info();
            // Parse Redis INFO response to get metrics
            const memoryMatch = info.match(/used_memory:(\d+)/);
            const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
            
            return {
              hits: 0, // Placeholder - actual implementation would track this
              misses: 0, // Placeholder - actual implementation would track this
              hitRate: 0, // Placeholder - actual implementation would calculate this
              evictions: 0, // Placeholder - actual implementation would track this
              memoryUsage,
            };
          } catch (error) {
            this.logger.error('Failed to get Redis info:', error);
          }
        }
      }
    }

    // Return default values if we can't get actual metrics
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Get cache health status
   */
  async getCacheHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unavailable';
    message: string;
  }> {
    try {
      // Test cache connectivity by setting and getting a test value
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'test-value';
      
      await this.cacheManager.set(testKey, testValue, 10);
      const result = await this.cacheManager.get(testKey);
      
      if (result === testValue) {
        return {
          status: 'healthy',
          message: 'Cache is responding correctly',
        };
      } else {
        return {
          status: 'degraded',
          message: 'Cache is responding but values not matching',
        };
      }
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      return {
        status: 'unavailable',
        message: `Cache is unavailable: ${error.message}`,
      };
    }
  }

  /**
   * Force cleanup of expired entries
   */
  async forceCleanup(): Promise<void> {
    // For Redis, expired entries are cleaned up automatically
    // This method is provided for completeness
    this.logger.log('Force cleanup initiated (handled by Redis automatically)');
  }
}