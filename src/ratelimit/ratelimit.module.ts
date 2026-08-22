import { Module, Global } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { AbuseDetectionService } from './abuse-detection.service';
import { DeterministicRateLimitService } from './deterministic-rate-limit.service';
import { RedisModule } from '../common/cache/redis.module';
import { ConfigModule } from '../config/config.module';
import { Reflector } from '@nestjs/core';

/**
 * Rate Limiting & Throttling Module
 *
 * Provides per-IP and per-user rate limiting with configurable limits
 * per endpoint and global burst control. Uses Redis for distributed
 * rate limiting across instances.
 *
 * Exports:
 * - RateLimitService: Redis-backed token bucket rate limiter
 * - RateLimitGuard: NestJS guard for per-route rate limiting via decorators
 * - AbuseDetectionService: Detects and auto-blocks abusive patterns
 * - DeterministicRateLimitService: In-memory token bucket fallback
 */
@Global()
@Module({
  imports: [RedisModule, ConfigModule],
  providers: [
    RateLimitService,
    RateLimitGuard,
    AbuseDetectionService,
    DeterministicRateLimitService,
    Reflector,
  ],
  exports: [
    RateLimitService,
    RateLimitGuard,
    AbuseDetectionService,
    DeterministicRateLimitService,
  ],
})
export class RateLimitModule {}
