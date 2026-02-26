import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  DataSource,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';

/**
 * Maps entity class names to the cache key patterns they affect.
 */
const ENTITY_CACHE_PATTERNS: Record<string, string[]> = {
  UserBalance: ['user:balance:*', 'user:balances:list:*'],
  Balance: ['user:balance:*', 'user:balances:list:*'],
  BalanceAudit: ['user:balance:history:*'],
  MarketData: ['market:data:*'],
  VirtualAsset: ['asset:*'],
};

@Injectable()
@EventSubscriber()
export class EntityCacheSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(EntityCacheSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {
    dataSource.subscribers.push(this);
  }

  /**
   * Runs after any entity is inserted
   */
  async afterInsert(event: InsertEvent<any>): Promise<void> {
    await this.invalidateForEntity(event.metadata.name, event.entity);
  }

  /**
   * Runs after any entity is updated
   */
  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    await this.invalidateForEntity(event.metadata.name, event.entity);
  }

  /**
   * Runs after any entity is removed
   */
  async afterRemove(event: RemoveEvent<any>): Promise<void> {
    await this.invalidateForEntity(event.metadata.name, event.entity);
  }

  private async invalidateForEntity(
    entityName: string,
    entity: any,
  ): Promise<void> {
    const patterns = ENTITY_CACHE_PATTERNS[entityName];
    if (!patterns) return;

    const userId: string | undefined = entity?.userId;

    const resolvedPatterns = patterns.map((p) =>
      userId ? p.replace('*', userId) : p,
    );

    this.logger.debug(
      `Entity "${entityName}" mutated → invalidating: ${resolvedPatterns.join(', ')}`,
    );

    await this.cacheInvalidationService.invalidateBatch(
      resolvedPatterns,
      entityName,
    );
  }
}