import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../services/cache.service';

export type WarmingPriority = 'critical' | 'high' | 'normal' | 'low';

export interface WarmingEntry<T = unknown> {
  key: string;
  loader: () => Promise<T>;
  priority: WarmingPriority;
  ttl: number;
  tags?: string[];
}

export interface TagInvalidationResult {
  tag: string;
  keysInvalidated: number;
  durationMs: number;
}

const PRIORITY_ORDER: Record<WarmingPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

@Injectable()
export class AdvancedCacheWarmingService {
  private readonly logger = new Logger(AdvancedCacheWarmingService.name);
  private readonly tagIndex = new Map<string, Set<string>>();

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Warm entries sorted by priority. Critical/high keys are warmed concurrently;
   * normal/low keys are batched in groups of 5 to prevent thundering herd on startup.
   */
  async warmPrioritized(entries: WarmingEntry[]): Promise<void> {
    const sorted = [...entries].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );

    const urgent = sorted.filter(
      (e) => e.priority === 'critical' || e.priority === 'high',
    );
    const deferred = sorted.filter(
      (e) => e.priority === 'normal' || e.priority === 'low',
    );

    await Promise.allSettled(urgent.map((e) => this.warmOne(e)));

    for (let i = 0; i < deferred.length; i += 5) {
      await Promise.allSettled(
        deferred.slice(i, i + 5).map((e) => this.warmOne(e)),
      );
    }
  }

  /**
   * Serve the cached value immediately and trigger background revalidation
   * when the entry is within staleThresholdMs of its TTL boundary.
   */
  async getWithStaleRevalidate<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number,
    staleThresholdMs = 10_000,
  ): Promise<T> {
    const cached = await this.cacheService.get<{ value: T; cachedAt: number }>(
      key,
    );

    if (cached !== undefined) {
      const ageMs = Date.now() - cached.cachedAt;
      if (ageMs > ttlSeconds * 1000 - staleThresholdMs) {
        void this.revalidate(key, loader, ttlSeconds);
      }
      return cached.value;
    }

    const value = await loader();
    await this.cacheService.set(
      key,
      { value, cachedAt: Date.now() },
      ttlSeconds,
    );
    return value;
  }

  /**
   * Write through to the primary store via persist(), then immediately
   * populate the cache so the next read is always warm.
   */
  async writeThrough<T>(
    key: string,
    value: T,
    persist: (v: T) => Promise<void>,
    ttlSeconds: number,
  ): Promise<void> {
    await persist(value);
    await this.cacheService.set(key, value, ttlSeconds);
    this.logger.debug(`write-through: persisted and cached "${key}"`);
  }

  /**
   * Associate a cache key with one or more tags for group invalidation.
   */
  registerTags(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   * Delete every cache key associated with a given tag.
   */
  async invalidateByTag(tag: string): Promise<TagInvalidationResult> {
    const start = Date.now();
    const keys = [...(this.tagIndex.get(tag) ?? [])];
    await Promise.allSettled(keys.map((key) => this.cacheService.del(key)));
    return {
      tag,
      keysInvalidated: keys.length,
      durationMs: Date.now() - start,
    };
  }

  private async warmOne(entry: WarmingEntry): Promise<void> {
    try {
      const value = await entry.loader();
      await this.cacheService.set(entry.key, value, entry.ttl);
      if (entry.tags?.length) this.registerTags(entry.key, entry.tags);
      this.logger.debug(`warmed [${entry.priority}] "${entry.key}"`);
    } catch (err) {
      this.logger.warn(
        `failed to warm "${entry.key}": ${(err as Error).message}`,
      );
    }
  }

  private async revalidate<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const value = await loader();
      await this.cacheService.set(
        key,
        { value, cachedAt: Date.now() },
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(
        `background revalidation failed for "${key}": ${(err as Error).message}`,
      );
    }
  }
}
