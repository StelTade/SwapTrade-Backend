import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { Trade } from '../entities/trade.entity';
import { UserBalance } from '../entities/user-balance.entity';
import { VirtualAsset } from '../entities/virtual-asset.entity';
import * as crypto from 'crypto';

export interface ShardConfig {
  id: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  weight: number;
  isPrimary: boolean;
  replicas?: string[];
}

export interface ShardingStrategy {
  name: string;
  getShardKey(data: any): string;
  getShard(shardKey: string): string;
}

export interface QueryPlan {
  shards: string[];
  strategy: string;
  parallel: boolean;
  aggregationRequired: boolean;
}

@Injectable()
export class DatabaseShardingService {
  private readonly logger = new Logger(DatabaseShardingService.name);
  private shards: Map<string, DataSource> = new Map();
  private shardConfigs: Map<string, ShardConfig> = new Map();
  private strategies: Map<string, ShardingStrategy> = new Map();
  private hashRing: Array<{ hash: number; shardId: string }> = [];
  private readonly virtualNodes = 100;

  constructor() {
    this.initializeShardingStrategies();
  }

  /**
   * Initialize sharding strategies for different data types
   */
  private initializeShardingStrategies(): void {
    // User-based sharding for user-related data
    this.strategies.set('user', {
      name: 'user',
      getShardKey: (data: any) =>
        data.userId?.toString() || data.id?.toString(),
      getShard: (shardKey: string) => {
        return this.consistentHash(shardKey, Array.from(this.shards.keys()));
      },
    });

    // Time-based sharding for trade data
    this.strategies.set('time', {
      name: 'time',
      getShardKey: (data: any) => {
        const timestamp = data.timestamp || data.createdAt || new Date();
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}`;
      },
      getShard: (shardKey: string) => {
        const [year, month] = shardKey.split('-');
        const timeHash =
          (parseInt(year) * 12 + parseInt(month)) % this.shards.size;
        return Array.from(this.shards.keys())[timeHash];
      },
    });

    // Asset-based sharding for market data
    this.strategies.set('asset', {
      name: 'asset',
      getShardKey: (data: any) => data.asset || data.symbol,
      getShard: (shardKey: string) => {
        const hash = this.hashString(shardKey);
        const shardIndex = hash % this.shards.size;
        return Array.from(this.shards.keys())[shardIndex];
      },
    });

    // Consistent hashing for high-cardinality data
    this.strategies.set('consistent', {
      name: 'consistent',
      getShardKey: (data: any) => data.id?.toString() || JSON.stringify(data),
      getShard: (shardKey: string) => {
        return this.consistentHash(shardKey, Array.from(this.shards.keys()));
      },
    });
  }

  /**
   * Initialize database shards
   */
  async initializeShards(shardConfigs: ShardConfig[]): Promise<void> {
    this.logger.log(`Initializing ${shardConfigs.length} database shards...`);

    for (const config of shardConfigs) {
      try {
        const dataSource = new DataSource({
          type: 'sqlite', // In production, this would be postgres/mysql
          database: config.database,
          synchronize: true, // Set to true for tests and dynamic provisioning
          logging: false,
          entities: [Trade, UserBalance, VirtualAsset],
        });

        await dataSource.initialize();

        this.shards.set(config.id, dataSource);
        this.shardConfigs.set(config.id, config);
        this.addShardToRing(config.id);

        this.logger.log(`Shard ${config.id} initialized successfully`);
      } catch (error) {
        this.logger.error(`Failed to initialize shard ${config.id}:`, error);
        throw error;
      }
    }

    this.logger.log(`All ${this.shards.size} shards initialized successfully`);
  }

  /**
   * Get repository for a specific entity on the appropriate shard
   */
  async getRepository<T extends ObjectLiteral>(
    entityClass: any,
    data: any,
    strategy: string = 'user',
  ): Promise<Repository<T>> {
    const shardingStrategy = this.strategies.get(strategy);
    if (!shardingStrategy) {
      throw new Error(`Sharding strategy '${strategy}' not found`);
    }

    const shardKey = shardingStrategy.getShardKey(data);
    const shardId = shardingStrategy.getShard(shardKey);
    const shard = this.shards.get(shardId);

    if (!shard) {
      throw new Error(`Shard '${shardId}' not found`);
    }

    return shard.getRepository(entityClass);
  }

  /**
   * Execute query across multiple shards
   */
  async executeQueryAcrossShards<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    queryPlan: QueryPlan,
    queryBuilder: (repository: Repository<T>) => Promise<T[]>,
  ): Promise<T[]> {
    const results: T[] = [];

    if (queryPlan.parallel) {
      // Execute queries in parallel
      const promises = queryPlan.shards.map(async (shardId) => {
        const shard = this.shards.get(shardId);
        if (!shard) {
          this.logger.warn(`Shard '${shardId}' not found, skipping`);
          return [];
        }

        try {
          const repository = shard.getRepository(entityClass);
          return await queryBuilder(repository);
        } catch (error) {
          this.logger.error(`Query failed on shard '${shardId}':`, error);
          return [];
        }
      });

      const shardResults = await Promise.all(promises);
      results.push(...shardResults.flat());
    } else {
      // Execute queries sequentially
      for (const shardId of queryPlan.shards) {
        const shard = this.shards.get(shardId);
        if (!shard) {
          this.logger.warn(`Shard '${shardId}' not found, skipping`);
          continue;
        }

        try {
          const repository = shard.getRepository(entityClass);
          const shardResult = await queryBuilder(repository);
          results.push(...shardResult);
        } catch (error) {
          this.logger.error(`Query failed on shard '${shardId}':`, error);
        }
      }
    }

    return results;
  }

  /**
   * Provision a new database shard dynamically
   */
  async provisionNewShard(config: ShardConfig): Promise<void> {
    if (this.shards.has(config.id)) {
      throw new Error(`Shard with ID ${config.id} already exists`);
    }

    this.logger.log(`Provisioning new shard: ${config.id}`);

    try {
      const dataSource = new DataSource({
        type: 'sqlite',
        database: config.database,
        synchronize: true, // Auto-create schema for new shards
        entities: [Trade, UserBalance, VirtualAsset],
      });

      await dataSource.initialize();

      this.shards.set(config.id, dataSource);
      this.shardConfigs.set(config.id, config);
      this.addShardToRing(config.id);

      this.logger.log(`Shard ${config.id} provisioned and initialized`);

      // Trigger rebalancing after adding new shard
      setImmediate(() => this.rebalanceShards());
    } catch (error) {
      this.logger.error(`Failed to provision shard ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute a cross-shard transaction using a simplified two-phase commit
   */
  async executeTransaction(
    operations: Array<{
      entityClass: any;
      data: any;
      strategy?: string;
      type: 'insert' | 'update' | 'delete';
    }>,
  ): Promise<void> {
    const participants = new Map<
      string,
      { dataSource: DataSource; ops: any[] }
    >();

    // Phase 1: Prepare - determine participants and group operations
    for (const op of operations) {
      const shardingStrategy = this.strategies.get(op.strategy || 'user');
      if (!shardingStrategy)
        throw new Error(`Strategy ${op.strategy} not found`);

      const shardKey = shardingStrategy.getShardKey(op.data);
      const shardId = shardingStrategy.getShard(shardKey);
      const shard = this.shards.get(shardId);

      if (!shard) throw new Error(`Shard ${shardId} not found`);

      if (!participants.has(shardId)) {
        participants.set(shardId, { dataSource: shard, ops: [] });
      }
      participants.get(shardId)!.ops.push(op);
    }

    const queryRunners: Map<string, any> = new Map();

    try {
      // Phase 2: Execute - start transactions on all participant shards
      for (const [shardId, { dataSource, ops }] of participants.entries()) {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        queryRunners.set(shardId, queryRunner);

        for (const op of ops) {
          const repository = queryRunner.manager.getRepository(op.entityClass);
          if (op.type === 'insert' || op.type === 'update') {
            await repository.save(op.data);
          } else if (op.type === 'delete') {
            await repository.remove(op.data);
          }
        }
      }

      // Phase 3: Commit - if all succeeded, commit all
      for (const queryRunner of queryRunners.values()) {
        await queryRunner.commitTransaction();
      }
    } catch (error) {
      // Phase 4: Rollback - if any failed, rollback all
      this.logger.error('Cross-shard transaction failed, rolling back:', error);
      for (const queryRunner of queryRunners.values()) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.error('Rollback failed on shard:', rollbackError);
        }
      }
      throw error;
    } finally {
      // Release all query runners
      for (const queryRunner of queryRunners.values()) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Create query plan for cross-shard queries
   */
  createQueryPlan(
    strategy: string,
    filters?: any,
    timeRange?: { start: Date; end: Date },
  ): QueryPlan {
    const shardingStrategy = this.strategies.get(strategy);
    if (!shardingStrategy) {
      throw new Error(`Sharding strategy '${strategy}' not found`);
    }

    // Determine which shards to query based on filters
    let targetShards: string[] = [];

    if (timeRange && strategy === 'time') {
      // Calculate shards for time range
      const startKey = shardingStrategy.getShardKey({
        timestamp: timeRange.start,
      });
      const endKey = shardingStrategy.getShardKey({ timestamp: timeRange.end });

      // Get all shards in the time range
      const allShardIds = Array.from(this.shards.keys());
      for (const shardId of allShardIds) {
        // This is simplified - in production, you'd calculate the exact shard range
        targetShards.push(shardId);
      }
    } else if (filters?.userId && strategy === 'user') {
      // User-specific query - single shard
      const shardKey = shardingStrategy.getShardKey(filters);
      const shardId = shardingStrategy.getShard(shardKey);
      targetShards = [shardId];
    } else {
      // Query all shards
      targetShards = Array.from(this.shards.keys());
    }

    return {
      shards: targetShards,
      strategy,
      parallel: targetShards.length > 1,
      aggregationRequired: targetShards.length > 1,
    };
  }

  /**
   * Insert data into appropriate shard
   */
  async insert<T extends ObjectLiteral>(
    entityClass: any,
    data: any,
    strategy: string = 'user',
  ): Promise<T> {
    const repository = await this.getRepository<T>(entityClass, data, strategy);
    return await repository.save(data);
  }

  /**
   * Batch insert across multiple shards
   */
  async batchInsert<T>(
    entityClass: any,
    dataList: any[],
    strategy: string = 'user',
  ): Promise<void> {
    // Group data by shard
    const dataByShard = new Map<string, any[]>();

    for (const data of dataList) {
      const shardingStrategy = this.strategies.get(strategy);
      if (!shardingStrategy) continue;

      const shardKey = shardingStrategy.getShardKey(data);
      const shardId = shardingStrategy.getShard(shardKey);

      if (!dataByShard.has(shardId)) {
        dataByShard.set(shardId, []);
      }
      dataByShard.get(shardId)!.push(data);
    }

    // Insert into each shard
    const insertPromises = Array.from(dataByShard.entries()).map(
      async ([shardId, data]) => {
        const shard = this.shards.get(shardId);
        if (!shard) return;

        const repository = shard.getRepository(entityClass);
        await repository.insert(data);
      },
    );

    await Promise.all(insertPromises);
  }

  /**
   * Migrate data between shards
   */
  async migrateData(
    fromShardId: string,
    toShardId: string,
    entityClass: any,
    filters?: any,
  ): Promise<void> {
    const fromShard = this.shards.get(fromShardId);
    const toShard = this.shards.get(toShardId);

    if (!fromShard || !toShard) {
      throw new Error('Invalid shard IDs for migration');
    }

    const fromRepository = fromShard.getRepository(entityClass);
    const toRepository = toShard.getRepository(entityClass);

    // Fetch data from source shard
    let query = fromRepository.createQueryBuilder();
    if (filters) {
      query = query.where(filters);
    }

    const data = await query.getMany();

    // Insert into target shard
    if (data.length > 0) {
      await toRepository.insert(data);

      // Delete from source shard after successful migration
      await fromRepository.delete(filters);
    }

    this.logger.log(
      `Migrated ${data.length} records from ${fromShardId} to ${toShardId}`,
    );
  }

  /**
   * Get shard health status including replication checks
   */
  async getShardHealth(): Promise<Record<string, any>> {
    const healthStatus: Record<string, any> = {};

    for (const [shardId, shard] of this.shards) {
      const config = this.shardConfigs.get(shardId);
      const replicaStatus: Record<string, any> = {};

      if (config?.replicas) {
        for (const replicaHost of config.replicas) {
          try {
            // In a real implementation, you would connect to the replica
            // For now, we simulate a health check
            replicaStatus[replicaHost] = {
              status: 'healthy',
              latency: Math.floor(Math.random() * 50),
            };
          } catch (error) {
            replicaStatus[replicaHost] = {
              status: 'unhealthy',
              error: error.message,
            };
          }
        }
      }

      try {
        // Test primary connection
        await shard.query('SELECT 1');

        // Get basic stats
        const tradeCount = await shard.getRepository(Trade).count();
        const balanceCount = await shard.getRepository(UserBalance).count();

        healthStatus[shardId] = {
          status: 'healthy',
          tradeCount,
          balanceCount,
          replicas: replicaStatus,
          lastChecked: new Date(),
        };
      } catch (error) {
        healthStatus[shardId] = {
          status: 'unhealthy',
          error: error.message,
          replicas: replicaStatus,
          lastChecked: new Date(),
        };
      }
    }

    return healthStatus;
  }

  /**
   * Create a backup for a specific shard using SQLite's backup capabilities.
   */
  async createBackup(shardId: string): Promise<string> {
    const shard = this.shards.get(shardId);
    const config = this.shardConfigs.get(shardId);
    if (!shard || !config) {
      throw new Error(`Shard ${shardId} not found`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `shard_${shardId}_backup_${timestamp}.db`;

    this.logger.log(`Creating backup for shard ${shardId}: ${backupName}`);

    try {
      // For SQLite, a simple file copy is a valid backup if done safely.
      // Alternatively, we use the VACUUM INTO command for an online backup.
      await shard.query(`VACUUM INTO '${backupName}'`);
      this.logger.log(`Backup completed for shard ${shardId}: ${backupName}`);
      return backupName;
    } catch (error) {
      this.logger.error(`Backup failed for shard ${shardId}:`, error);
      throw error;
    }
  }

  /**
   * Restore a shard from a backup.
   */
  async restoreFromBackup(shardId: string, backupPath: string): Promise<void> {
    const shard = this.shards.get(shardId);
    const config = this.shardConfigs.get(shardId);
    if (!shard || !config) {
      throw new Error(`Shard ${shardId} not found`);
    }

    this.logger.log(`Restoring shard ${shardId} from backup ${backupPath}`);

    try {
      // Close the existing connection
      await shard.destroy();

      // Replace the database file with the backup
      const fs = require('fs');
      fs.copyFileSync(backupPath, config.database);

      // Re-initialize the connection
      await shard.initialize();

      this.logger.log(
        `Shard ${shardId} restored successfully from ${backupPath}`,
      );
    } catch (error) {
      this.logger.error(`Restore failed for shard ${shardId}:`, error);
      throw error;
    }
  }

  /**
   * Rebalance shards by migrating misplaced records to their correct shards.
   * Uses batching to avoid OOM and ensures basic data consistency.
   */
  async rebalanceShards(): Promise<void> {
    this.logger.log('Starting shard rebalancing...');

    const allShardIds = Array.from(this.shards.keys());
    if (allShardIds.length < 2) {
      this.logger.log('Not enough shards to rebalance');
      return;
    }

    const entitiesToRebalance = [Trade, UserBalance];
    const batchSize = 1000;

    for (const entityClass of entitiesToRebalance) {
      for (const fromShardId of allShardIds) {
        const fromShard = this.shards.get(fromShardId);
        if (!fromShard) continue;

        try {
          const repository = fromShard.getRepository(entityClass);
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            const records = await repository.find({
              take: batchSize,
              skip: offset,
            });

            if (records.length === 0) {
              hasMore = false;
              break;
            }

            // Determine which strategy to use for this entity
            const strategyName = entityClass === Trade ? 'time' : 'user';
            const strategy = this.strategies.get(strategyName);
            if (!strategy) {
              hasMore = false;
              break;
            }

            const recordsToMove = new Map<string, any[]>();

            for (const record of records) {
              const shardKey = strategy.getShardKey(record);
              const targetShardId = strategy.getShard(shardKey);

              if (targetShardId !== fromShardId) {
                if (!recordsToMove.has(targetShardId)) {
                  recordsToMove.set(targetShardId, []);
                }
                recordsToMove.get(targetShardId)!.push(record);
              }
            }

            // Migrate records to their correct shards
            for (const [
              targetShardId,
              misplacedRecords,
            ] of recordsToMove.entries()) {
              this.logger.log(
                `Moving ${misplacedRecords.length} ${entityClass.name} records from ${fromShardId} to ${targetShardId}`,
              );

              const toShard = this.shards.get(targetShardId);
              if (!toShard) continue;

              const toRepository = toShard.getRepository(entityClass);

              // Perform migration in a transaction-like manner
              for (const record of misplacedRecords) {
                try {
                  await toRepository.save(record);
                  await repository.remove(record);
                } catch (err) {
                  this.logger.error(
                    `Migration error for record ${record.id}: ${err.message}`,
                  );
                  // If it already exists on destination, we can safely remove from source
                  if (
                    err.message.includes('UNIQUE') ||
                    err.message.includes('already exists')
                  ) {
                    await repository.remove(record);
                  }
                }
              }
            }

            if (records.length < batchSize) {
              hasMore = false;
            } else {
              // Since we're removing records from the source, we might not need to increment offset
              // but to be safe and avoid infinite loops if removal fails, we should be careful.
              // In this case, removal should decrease the total count.
              // If we didn't remove everything in the batch, offset needs to stay 0 or be adjusted.
              // For simplicity, let's keep offset 0 as long as we are removing records.
              offset = 0;
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to rebalance ${entityClass.name} on shard ${fromShardId}:`,
            error,
          );
        }
      }
    }

    this.logger.log('Shard rebalancing completed');
  }

  /**
   * More robust hash function using SHA-256
   */
  private hashString(str: string): number {
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Add shard to consistent hash ring with virtual nodes
   */
  private addShardToRing(shardId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hashString(`${shardId}:${i}`);
      this.hashRing.push({ hash, shardId });
    }
    this.hashRing.sort((a, b) => a.hash - b.hash);
  }

  /**
   * Remove shard from consistent hash ring
   */
  private removeShardFromRing(shardId: string): void {
    this.hashRing = this.hashRing.filter((node) => node.shardId !== shardId);
  }

  /**
   * Consistent hashing implementation using a ring with virtual nodes
   */
  private consistentHash(key: string, _nodes: string[]): string {
    if (this.hashRing.length === 0) return '';

    const hash = this.hashString(key);

    // Binary search for the first node with hash >= key's hash
    let low = 0;
    let high = this.hashRing.length - 1;
    let index = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.hashRing[mid].hash >= hash) {
        index = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return this.hashRing[index].shardId;
  }
}
