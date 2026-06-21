import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
  CONFLICT = 'conflict',
}

@Entity('offline_sync_queue')
@Index(['userId', 'status'])
export class OfflineSyncItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  /** e.g. "order", "profile", "trade" */
  @Column()
  entityType: string;

  @Column({ nullable: true })
  entityId?: string;

  @Column({ type: 'varchar', default: SyncStatus.PENDING })
  status: SyncStatus;

  /** The mutation payload captured offline */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Server-assigned checksum for conflict detection */
  @Column({ nullable: true })
  checksum?: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true, type: 'timestamp' })
  syncedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
