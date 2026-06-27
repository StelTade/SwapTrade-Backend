import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { OfflineSyncItem, SyncStatus } from '../entities/offline-sync.entity';
import { BatchSyncDto, SyncItemDto } from '../dto/mobile.dto';

const MAX_RETRIES = 3;

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(
    @InjectRepository(OfflineSyncItem)
    private readonly syncRepo: Repository<OfflineSyncItem>,
  ) {}

  async enqueueBatch(
    userId: string,
    dto: BatchSyncDto,
  ): Promise<{ queued: number; conflicts: string[] }> {
    const conflicts: string[] = [];
    const items: OfflineSyncItem[] = [];

    for (const item of dto.items) {
      const conflict = await this.detectConflict(userId, item);
      if (conflict) {
        conflicts.push(item.entityId ?? item.entityType);
        continue;
      }
      items.push(
        this.syncRepo.create({
          userId,
          entityType: item.entityType,
          entityId: item.entityId,
          payload: item.payload,
          checksum: item.checksum ?? this.computeChecksum(item.payload),
          status: SyncStatus.PENDING,
        }),
      );
    }

    await this.syncRepo.save(items);
    return { queued: items.length, conflicts };
  }

  async processPending(
    userId: string,
  ): Promise<{ processed: number; failed: number }> {
    const pending = await this.syncRepo.find({
      where: { userId, status: SyncStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    let processed = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Domain-specific handlers can be injected here via a strategy map.
        // For now we mark as synced (actual business logic is in domain services).
        item.status = SyncStatus.SYNCED;
        item.syncedAt = new Date();
        processed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        item.retryCount += 1;
        item.errorMessage = msg;
        item.status =
          item.retryCount >= MAX_RETRIES
            ? SyncStatus.FAILED
            : SyncStatus.PENDING;
        failed++;
        this.logger.warn(
          `Sync item ${item.id} failed (attempt ${item.retryCount}): ${msg}`,
        );
      }
      await this.syncRepo.save(item);
    }

    return { processed, failed };
  }

  async getPendingCount(userId: string): Promise<number> {
    return this.syncRepo.count({
      where: { userId, status: SyncStatus.PENDING },
    });
  }

  async getHistory(userId: string, limit = 20): Promise<OfflineSyncItem[]> {
    return this.syncRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private computeChecksum(payload: Record<string, unknown>): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);
  }

  private async detectConflict(
    userId: string,
    item: SyncItemDto,
  ): Promise<boolean> {
    if (!item.entityId || !item.checksum) return false;
    const existing = await this.syncRepo.findOne({
      where: {
        userId,
        entityType: item.entityType,
        entityId: item.entityId,
        status: SyncStatus.SYNCED,
      },
      order: { syncedAt: 'DESC' },
    });
    return (
      existing?.checksum !== undefined && existing.checksum !== item.checksum
    );
  }
}
