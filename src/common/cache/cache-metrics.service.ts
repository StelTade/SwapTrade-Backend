import { Injectable, Logger } from '@nestjs/common';

export interface CacheMetricSnapshot {
  hits: number;
  misses: number;
  invalidations: number;
  hitRate: number;
  entityType: string;
}

@Injectable()
export class CacheMetricsService {
  private readonly logger = new Logger(CacheMetricsService.name);

  private metrics = new Map
    string,
    { hits: number; misses: number; invalidations: number }
  >();

  recordHit(entityType: string): void {
    this.getOrInit(entityType).hits++;
    this.logger.verbose(`Cache HIT [${entityType}]`);
  }

  recordMiss(entityType: string): void {
    this.getOrInit(entityType).misses++;
    this.logger.verbose(`Cache MISS [${entityType}]`);
  }

  recordInvalidation(entityType: string): void {
    this.getOrInit(entityType).invalidations++;
    this.logger.debug(`Cache INVALIDATED [${entityType}]`);
  }

  getMetrics(entityType?: string): CacheMetricSnapshot[] {
    const entries = entityType
      ? [[entityType, this.getOrInit(entityType)] as const]
      : Array.from(this.metrics.entries());

    return entries.map(([entity, m]) => ({
      entityType: entity,
      hits: m.hits,
      misses: m.misses,
      invalidations: m.invalidations,
      hitRate:
        m.hits + m.misses > 0
          ? Math.round((m.hits / (m.hits + m.misses)) * 10000) / 100
          : 0,
    }));
  }

  resetMetrics(entityType?: string): void {
    if (entityType) {
      this.metrics.set(entityType, { hits: 0, misses: 0, invalidations: 0 });
    } else {
      this.metrics.clear();
    }
  }

  private getOrInit(entityType: string) {
    if (!this.metrics.has(entityType)) {
      this.metrics.set(entityType, { hits: 0, misses: 0, invalidations: 0 });
    }
    return this.metrics.get(entityType)!;
  }
}