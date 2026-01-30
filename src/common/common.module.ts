import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CacheService } from './services/cache.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheWarmingService } from './services/cache.warming.service';
import { CacheMonitoringService } from './services/cache.monitoring.service';
import { ErrorLoggerService } from './logging/error-logger.service';
import { LoggerService } from './logging/logger_service';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { CustomCacheModule } from './cache/cache.module';
import { CacheStatisticsService } from './services/cache-statistics.service';
import { CacheCircuitBreaker } from './services/cache-circuit-breaker.service';
import { CacheWarmingService as AdvancedCacheWarmingService } from './services/cache-warming-advanced.service';
import { CacheManagementController } from './controllers/cache-management.controller';
import { AdvancedCacheInterceptor } from './interceptors/advanced-cache.interceptor';
import { BalanceModule } from '../balance/balance.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [
    CustomCacheModule,
    ScheduleModule.forRoot(),
    // Import balance and portfolio for cache warming
  ],
  controllers: [CommonController, CacheManagementController],
  providers: [
    CommonService,
    CacheService,
    CacheInterceptor,
    CacheWarmingService,
    CacheMonitoringService,
    ErrorLoggerService,
    LoggerService,
    GlobalExceptionFilter,
    CacheStatisticsService,
    CacheCircuitBreaker,
    AdvancedCacheWarmingService,
    AdvancedCacheInterceptor,
  ],
  exports: [
    CacheService,
    CacheInterceptor,
    CacheWarmingService,
    CacheMonitoringService,
    ErrorLoggerService,
    LoggerService,
    GlobalExceptionFilter,
    CacheStatisticsService,
    CacheCircuitBreaker,
    AdvancedCacheWarmingService,
    AdvancedCacheInterceptor,
  ],
})
export class CommonModule {}
