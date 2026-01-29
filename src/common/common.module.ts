import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CacheService } from './services/cache.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheWarmingService } from './services/cache.warming.service';
import { CacheMonitoringService } from './services/cache.monitoring.service';
import { ErrorLoggerService } from './logging/error-logger.service';
import { LoggerService } from './logging/logger_service';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Module({
  controllers: [CommonController],
  providers: [
    CommonService,
    CacheService,
    CacheInterceptor,
    CacheWarmingService,
    CacheMonitoringService,
    ErrorLoggerService,
    LoggerService,
    GlobalExceptionFilter,
  ],
  exports: [
    CacheService,
    CacheInterceptor,
    CacheWarmingService,
    CacheMonitoringService,
    ErrorLoggerService,
    LoggerService,
    GlobalExceptionFilter,
  ],
})
export class CommonModule {}
