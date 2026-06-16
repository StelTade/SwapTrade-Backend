import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import { Trade } from '../entities/trade.entity';
import { UserBalance } from '../entities/user-balance.entity';

export interface ShardConfig {
  id: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  weight: number;
  isPrimary: boolean;
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
      getShardKey: (data: any) => data.userId?.toString() || data.id?.toString(),
      getShard: (shardKey: string) => {
        const hash = this.hashString(shardKey);
        const shardIndex = hash % this.shards.size;
        return Array.from(this.shards.keys())[shardIndex];
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
        const timeHash = (parseInt(year) * 12 + parseInt(month)) % this.shards.size;
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
          synchronize: false,
          logging: false,
          entities: [Trade, UserBalance],
        });

        await dataSource.initialize();
        
        this.shards.set(config.id, dataSource);
        this.shardConfigs.set(config.id, config);
        
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
          const repository = shard.getRepository(Trade); // Adjust entity type as needed
          return await queryBuilder(repository as unknown as Repository<T>);
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
          const repository = shard.getRepository(Trade); // Adjust entity type as needed
          const shardResult = await queryBuilder(repository as unknown as Repository<T>);
          results.push(...shardResult);
        } catch (error) {
          this.logger.error(`Query failed on shard '${shardId}':`, error);
        }
      }
    }

    return results;
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
      const startKey = shardingStrategy.getShardKey({ timestamp: timeRange.start });
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
  async insert<T extends ObjectLiteral>(entityClass: any, data: any, strategy: string = 'user'): Promise<T> {
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
    const insertPromises = Array.from(dataByShard.entries()).map(async ([shardId, data]) => {
      const shard = this.shards.get(shardId);
      if (!shard) return;

      const repository = shard.getRepository(entityClass);
      await repository.insert(data);
    });

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

    this.logger.log(`Migrated ${data.length} records from ${fromShardId} to ${toShardId}`);
  }

  /**
   * Get shard health status
   */
  async getShardHealth(): Promise<Record<string, any>> {
    const healthStatus: Record<string, any> = {};

    for (const [shardId, shard] of this.shards) {
      try {
        // Test connection
        await shard.query('SELECT 1');
        
        // Get basic stats
        const tradeCount = await shard.getRepository(Trade).count();
        const balanceCount = await shard.getRepository(UserBalance).count();

        healthStatus[shardId] = {
          status: 'healthy',
          tradeCount,
          balanceCount,
          lastChecked: new Date(),
        };
      } catch (error) {
        healthStatus[shardId] = {
          status: 'unhealthy',
          error: error.message,
          lastChecked: new Date(),
        };
      }
    }

    return healthStatus;
  }

  /**
   * Rebalance shards based on load
   */
  async rebalanceShards(): Promise<void> {
    this.logger.log('Starting shard rebalancing...');
    
    const healthStatus = await this.getShardHealth();
    const shardLoads: Record<string, number> = {};

    // Calculate load per shard (simplified - based on record count)
    for (const [shardId, status] of Object.entries(healthStatus)) {
      if (status.status === 'healthy') {
        shardLoads[shardId] = status.tradeCount + status.balanceCount;
      }
    }

    // Find overloaded and underloaded shards
    const loads = Object.values(shardLoads);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const threshold = avgLoad * 1.5; // 50% above average is considered overloaded

    const overloadedShards = Object.entries(shardLoads)
      .filter(([_, load]) => load > threshold)
      .map(([shardId, _]) => shardId);

    const underloadedShards = Object.entries(shardLoads)
      .filter(([_, load]) => load < avgLoad * 0.5)
      .map(([shardId, _]) => shardId);

    this.logger.log(`Found ${overloadedShards.length} overloaded and ${underloadedShards.length} underloaded shards`);

    // In a real implementation, you would move data from overloaded to underloaded shards
    // This is a placeholder for the rebalancing logic
    if (overloadedShards.length > 0 && underloadedShards.length > 0) {
      this.logger.log('Rebalancing would be performed here');
    }

    this.logger.log('Shard rebalancing completed');
  }

  /**
   * Simple hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Consistent hashing implementation
   */
  private consistentHash(key: string, nodes: string[]): string {
    if (nodes.length === 0) return '';
    
    // Simple consistent hashing - in production, use a proper ring implementation
    const hash = this.hashString(key);
    const index = hash % nodes.length;
    return nodes[index];
  }
}