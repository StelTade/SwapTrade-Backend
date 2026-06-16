import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

import { Trade } from './entities/trade.entity';
import { UserBalance } from './entities/user-balance.entity';
import { VirtualAsset } from './entities/virtual-asset.entity';

import { OptimizedQueryService } from './services/optimized-query.service';
import { MultiLevelCacheService } from './services/multi-level-cache.service';
import { DatabaseShardingService } from './services/database-sharding.service';
import { QueryOptimizationService } from './services/query-optimization.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { DatabaseLoadBalancerService } from './services/database-load-balancer.service';
import { DatabaseBenchmarkingService } from './services/database-benchmarking.service';
import { DatabaseMigrationService } from './services/database-migration.service';
import { IntelligentCacheService } from './services/intelligent-cache.service';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { CustomCacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, UserBalance, VirtualAsset]),
    ConfigModule,
    CustomCacheModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [DatabaseController],
  providers: [
    DatabaseService,
    OptimizedQueryService,
    MultiLevelCacheService,
    DatabaseShardingService,
    QueryOptimizationService,
    PerformanceMonitoringService,
    DatabaseLoadBalancerService,
    DatabaseBenchmarkingService,
    DatabaseMigrationService,
    IntelligentCacheService,
  ],
  exports: [
    DatabaseService,
    OptimizedQueryService,
    MultiLevelCacheService,
    DatabaseShardingService,
    QueryOptimizationService,
    PerformanceMonitoringService,
    DatabaseLoadBalancerService,
    DatabaseBenchmarkingService,
    DatabaseMigrationService,
    IntelligentCacheService,
  ],
})
export class DatabaseModule {}
