import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  points?: number; // tokens per window
  refillPerSecond?: number; // tokens added per second
  burst?: number; // max burst tokens
  keyGenerator?: 'ip' | 'user';
}

export const RATE_LIMIT_KEY = '__rate_limit_options__';

export const RateLimit = (opts: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, opts);
