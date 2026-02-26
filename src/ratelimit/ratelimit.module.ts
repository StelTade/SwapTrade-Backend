import { Module, Global } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { CustomCacheModule } from '../common/cache/cache.module';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [CustomCacheModule, ConfigModule],
  providers: [RateLimitService, RateLimitGuard, Reflector],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
