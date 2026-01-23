import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CacheService } from './services/cache.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheWarmingService } from './services/cache.warming.service';
import { CacheMonitoringService } from './services/cache.monitoring.service';

@Module({
  controllers: [CommonController],
  providers: [CommonService, CacheService, CacheInterceptor, CacheWarmingService, CacheMonitoringService],
  exports: [CacheService, CacheInterceptor, CacheWarmingService, CacheMonitoringService],
})
export class CommonModule {}
