import { Module } from '@nestjs/common';
import { DatabaseModule as OriginalDatabaseModule } from '../../database/database.module';

/**
 * Infrastructure Database Facade Module
 *
 * Wraps the original DatabaseModule from src/database/.
 * Provides: DatabaseService, OptimizedQueryService, MultiLevelCacheService,
 *           DatabaseShardingService, QueryOptimizationService, PerformanceMonitoringService,
 *           DatabaseLoadBalancerService, DatabaseBenchmarkingService, DatabaseMigrationService,
 *           IntelligentCacheService
 */
@Module({
  imports: [OriginalDatabaseModule],
  exports: [OriginalDatabaseModule],
})
export class InfrastructureDatabaseModule {}
