import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import Redis from 'ioredis';
import { adaptiveBackoffWithJitter } from './redis-backoff.util';
import { RedisMetricsService } from './redis-metrics.service';

export interface RedisPoolMetrics {
  poolSize: number;
  available: number;
  inUse: number;
  totalAcquired: number;
  totalReleased: number;
  totalRetries: number;
  totalConnectionErrors: number;
}

/**
 * Redis connection pool with adaptive backoff on connect.
 * Maintains min/max ioredis clients and tracks utilization for metrics.
 */
@Injectable()
export class RedisPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPoolService.name);
  private readonly pool: Redis[] = [];
  private readonly inUse = new Set<Redis>();
  private totalAcquired = 0;
  private totalReleased = 0;
  private totalRetries = 0;
  private totalConnectionErrors = 0;
  private closed = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: RedisMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redis = this.configService.redis;
    const min = redis.poolMin ?? 2;
    for (let i = 0; i < min; i++) {
      try {
        const client = await this.createClientWithBackoff();
        this.pool.push(client);
      } catch (err) {
        this.logger.warn(`Pool prefill: failed to create connection ${i + 1}/${min}`, (err as Error).message);
        this.totalConnectionErrors++;
        this.metricsService.recordConnectionError();
      }
    }
    this.logger.log(`Redis pool initialized with ${this.pool.length} connection(s), max ${redis.poolMax ?? 10}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    const all = [...this.pool, ...this.inUse];
    await Promise.all(all.map(c => c.quit().catch(() => {})));
    this.pool.length = 0;
    this.inUse.clear();
  }

  /**
   * Acquire a Redis client from the pool. Caller must call release() when done.
   */
  async acquire(): Promise<Redis> {
    if (this.closed) {
      throw new Error('Redis pool is closed');
    }

    let client = this.pool.pop();
    if (client) {
      this.inUse.add(client);
      this.totalAcquired++;
      this.metricsService.recordAcquire(this.pool.length, this.inUse.size);
      return client;
    }

    const redis = this.configService.redis;
    const max = redis.poolMax ?? 10;
    if (this.pool.length + this.inUse.size >= max) {
      this.metricsService.recordPoolExhaustion();
      throw new Error(`Redis pool exhausted (max ${max})`);
    }

    client = await this.createClientWithBackoff();
    this.inUse.add(client);
    this.totalAcquired++;
    this.metricsService.recordAcquire(this.pool.length, this.inUse.size);
    return client;
  }

  /**
   * Release a client back to the pool.
   */
  release(client: Redis): void {
    if (!this.inUse.has(client)) {
      return;
    }
    this.inUse.delete(client);
    this.totalReleased++;
    if (!this.closed) {
      this.pool.push(client);
    } else {
      client.quit().catch(() => {});
    }
    this.metricsService.recordRelease(this.pool.length, this.inUse.size);
  }

  /**
   * Execute a function with an acquired client. Automatically releases.
   */
  async withClient<T>(fn: (client: Redis) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    try {
      return await fn(client);
    } finally {
      this.release(client);
    }
  }

  getMetrics(): RedisPoolMetrics {
    return {
      poolSize: this.pool.length + this.inUse.size,
      available: this.pool.length,
      inUse: this.inUse.size,
      totalAcquired: this.totalAcquired,
      totalReleased: this.totalReleased,
      totalRetries: this.totalRetries,
      totalConnectionErrors: this.totalConnectionErrors,
    };
  }

  private async createClientWithBackoff(): Promise<Redis> {
    const redis = this.configService.redis;
    const baseMs = redis.backoffBaseMs ?? 100;
    const maxMs = redis.backoffMaxMs ?? 30000;
    const maxAttempts = redis.backoffMaxAttempts ?? 10;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const client = this.createOneClient();
        await new Promise<void>((resolve, reject) => {
          client.once('ready', () => resolve());
          client.once('error', (err: Error) => reject(err));
        });
        return client;
      } catch (err) {
        lastError = err as Error;
        this.totalRetries++;
        this.metricsService.recordRetry(attempt + 1);
        if (attempt < maxAttempts - 1) {
          const delay = adaptiveBackoffWithJitter(attempt, baseMs, maxMs);
          this.logger.warn(
            `Redis connect attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${delay}ms: ${(lastError as Error).message}`,
          );
          await this.sleep(delay);
        }
      }
    }
    this.totalConnectionErrors++;
    this.metricsService.recordConnectionError();
    throw lastError ?? new Error('Redis connection failed');
  }

  private createOneClient(): Redis {
    const redis = this.configService.redis;
    return new Redis({
      host: redis.host,
      port: redis.port,
      username: redis.username,
      password: redis.password,
      db: redis.db ?? 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: redis.enableReadyCheck ?? false,
      retryStrategy: () => null,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
