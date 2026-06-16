/**
 * Infrastructure Rate Limiter Module
 * Rate limiting, DDoS protection, quota management
 *
 * Facade over src/ratelimit/ — original implementation location
 */

export { InfrastructureRateLimiterModule } from './rate-limiter.module';
export { RateLimitModule } from '../../ratelimit/ratelimit.module';
export { RateLimitService } from '../../ratelimit/rate-limit.service';
export { RateLimitGuard } from '../../ratelimit/rate-limit.guard';
