import { Injectable } from '@nestjs/common';

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * Token-bucket rate limiter with deterministic refill.
 * Each (key, endpoint) pair gets its own bucket so limits are
 * enforced independently per sensitive API route.
 */
@Injectable()
export class DeterministicRateLimitService {
  private readonly buckets = new Map<string, BucketState>();

  /**
   * Returns true if the request is allowed, false if rate-limited.
   *
   * @param key       Unique caller identifier (e.g. userId or IP)
   * @param endpoint  Route identifier (e.g. 'kyc-submit')
   * @param capacity  Max tokens per window
   * @param refillRatePerMs Tokens added per millisecond
   */
  isAllowed(
    key: string,
    endpoint: string,
    capacity: number,
    refillRatePerMs: number,
  ): boolean {
    const bucketKey = `${endpoint}::${key}`;
    const now = Date.now();

    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefillMs: now };
      this.buckets.set(bucketKey, bucket);
    }

    // Deterministic refill based on elapsed time
    const elapsed = now - bucket.lastRefillMs;
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + elapsed * refillRatePerMs,
    );
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  /** Remove all buckets for a given key (e.g. on logout). */
  clearKey(key: string): void {
    for (const bucketKey of this.buckets.keys()) {
      if (bucketKey.includes(`::${key}`)) {
        this.buckets.delete(bucketKey);
      }
    }
  }
}
