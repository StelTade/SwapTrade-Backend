import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  DataSource,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserBalance } from '../../balance/user-balance.entity';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';

/**
 * Dedicated subscriber for UserBalance — provides fine-grained,
 * transaction-aware cache invalidation with user-scoped keys.
 */
@Injectable()
@EventSubscriber()
export class BalanceCacheSubscriber
  implements EntitySubscriberInterface<UserBalance>
{
  private readonly logger = new Logger(BalanceCacheSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return UserBalance;
  }

  async afterInsert(event: InsertEvent<UserBalance>): Promise<void> {
    await this.handleMutation(event.entity?.userId);
  }

  async afterUpdate(event: UpdateEvent<UserBalance>): Promise<void> {
    await this.handleMutation(event.entity?.userId ?? event.databaseEntity?.userId);
  }

  private async handleMutation(userId?: string): Promise<void> {
    if (!userId) return;

    this.logger.debug(
      `UserBalance mutated for userId=${userId} — invalidating caches`,
    );

    await this.cacheInvalidationService.invalidateBatch(
      [
        `user:balance:${userId}`,
        `user:balances:list:${userId}`,
        `user:portfolio:${userId}`,
      ],
      'UserBalance',
    );
  }
}