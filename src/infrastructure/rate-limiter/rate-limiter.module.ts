import { Module } from '@nestjs/common';
import { RateLimitModule as OriginalRateLimitModule } from '../../ratelimit/ratelimit.module';

/**
 * Infrastructure Rate Limiter Facade Module
 *
 * Wraps the original RateLimitModule from src/ratelimit/.
 * Provides: RateLimitService, RateLimitGuard (Global)
 */
@Module({
  imports: [OriginalRateLimitModule],
  exports: [OriginalRateLimitModule],
})
export class InfrastructureRateLimiterModule {}
