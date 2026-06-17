import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';

interface IndexRecommendation {
  tableName: string;
  columnName: string;
  indexType: 'btree' | 'hash' | 'gin' | 'partial';
  reason: string;
  estimatedImprovement: number;
  priority: 'high' | 'medium' | 'low';
}

interface IndexAnalysisResult {
  existingIndexes: Array<{
    tableName: string;
    indexName: string;
    columns: string[];
    type: string;
  }>;
  recommendations: IndexRecommendation[];
  compositeIndexes: Array<{
    tableName: string;
    columns: string[];
    reason: string;
  }>;
}

@Injectable()
export class IndexOptimizationService {
  private readonly logger = new Logger(IndexOptimizationService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Analyze existing indexes and recommend optimizations
   */
  async analyzeIndexes(): Promise<IndexAnalysisResult> {
    const existingIndexes = await this.getExistingIndexes();
    const recommendations =
      await this.generateIndexRecommendations(existingIndexes);
    const compositeIndexes = await this.analyzeCompositeIndexes();

    return {
      existingIndexes,
      recommendations,
      compositeIndexes,
    };
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(
    recommendations: IndexRecommendation[],
  ): Promise<void> {
    for (const recommendation of recommendations) {
      try {
        await this.createIndex(recommendation);
        this.logger.log(
          `Created index: ${recommendation.tableName}.${recommendation.columnName}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create index: ${recommendation.tableName}.${recommendation.columnName}`,
          error.stack,
        );
      }
    }
  }

  /**
   * Get query execution plan with index usage
   */
  async getExecutionPlan(query: string, parameters: any[] = []): Promise<any> {
    try {
      if (this.dataSource.options.type === 'postgres') {
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
        const result = await this.dataSource.query(explainQuery, parameters);
        return this.analyzePostgresPlan(result);
      }

      if (this.dataSource.options.type === 'sqlite') {
        const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
        const result = await this.dataSource.query(explainQuery, parameters);
        return this.analyzeSQLitePlan(result);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get execution plan for query: ${query}`,
        error.stack,
      );
      return null;
    }
  }

  private async getExistingIndexes(): Promise<
    Array<{
      tableName: string;
      indexName: string;
      columns: string[];
      type: string;
    }>
  > {
    const indexes: Array<{
      tableName: string;
      indexName: string;
      columns: string[];
      type: string;
    }> = [];

    try {
      if (this.dataSource.options.type === 'postgres') {
        const query = `
          SELECT 
            schemaname,
            tablename,
            indexname,
            indexdef
          FROM pg_indexes 
          WHERE schemaname = 'public'
          ORDER BY tablename, indexname
        `;
        const result = await this.dataSource.query(query);

        for (const row of result) {
          indexes.push({
            tableName: row.tablename,
            indexName: row.indexname,
            columns: this.extractColumnsFromIndexDef(row.indexdef),
            type: 'btree',
          });
        }
      } else if (this.dataSource.options.type === 'sqlite') {
        const query = `PRAGMA index_list('trades')`;
        const result = await this.dataSource.query(query);

        for (const row of result) {
          const columnsQuery = `PRAGMA index_info('${row.name}')`;
          const columns = await this.dataSource.query(columnsQuery);

          indexes.push({
            tableName: 'trades',
            indexName: row.name,
            columns: columns.map((col) => col.name),
            type: 'btree',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to get existing indexes', error.stack);
    }

    return indexes;
  }

  private async generateIndexRecommendations(
    existingIndexes: any[],
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    const entityMetadatas = this.dataSource.entityMetadatas;

    for (const metadata of entityMetadatas) {
      const tableName = metadata.tableName;
      const tableIndexes = existingIndexes.filter(
        (idx) => idx.tableName === tableName,
      );

      // Analyze foreign keys for indexing
      for (const foreignKey of metadata.foreignKeys) {
        const indexedColumns = tableIndexes.flatMap((idx) => idx.columns);
        const fkcColumn = foreignKey.columnNames[0];

        if (!indexedColumns.includes(fkcColumn)) {
          recommendations.push({
            tableName,
            columnName: fkcColumn,
            indexType: 'btree',
            reason: 'Foreign key column should be indexed for JOIN performance',
            estimatedImprovement: 80,
            priority: 'high',
          });
        }
      }

      // Analyze WHERE clause patterns based on common queries
      const commonWhereColumns = this.getCommonWhereColumns(tableName);
      for (const column of commonWhereColumns) {
        const indexedColumns = tableIndexes.flatMap((idx) => idx.columns);

        if (!indexedColumns.includes(column)) {
          recommendations.push({
            tableName,
            columnName: column,
            indexType: 'btree',
            reason: 'Frequently used in WHERE clauses',
            estimatedImprovement: 60,
            priority: 'medium',
          });
        }
      }

      // Analyze ORDER BY patterns
      const commonOrderByColumns = this.getCommonOrderByColumns(tableName);
      for (const column of commonOrderByColumns) {
        const indexedColumns = tableIndexes.flatMap((idx) => idx.columns);

        if (!indexedColumns.includes(column)) {
          recommendations.push({
            tableName,
            columnName: column,
            indexType: 'btree',
            reason: 'Frequently used in ORDER BY clauses',
            estimatedImprovement: 50,
            priority: 'medium',
          });
        }
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async analyzeCompositeIndexes(): Promise<
    Array<{
      tableName: string;
      columns: string[];
      reason: string;
    }>
  > {
    const compositeIndexes: Array<{
      tableName: string;
      columns: string[];
      reason: string;
    }> = [];

    // Trade table composite indexes
    compositeIndexes.push({
      tableName: 'trades',
      columns: ['userId', 'asset', 'timestamp'],
      reason: 'Optimize user trade history queries with asset filtering',
    });

    compositeIndexes.push({
      tableName: 'trades',
      columns: ['asset', 'status', 'timestamp'],
      reason: 'Optimize active order queries by asset',
    });

    compositeIndexes.push({
      tableName: 'trades',
      columns: ['buyerId', 'timestamp'],
      reason: 'Optimize buyer trade history queries',
    });

    compositeIndexes.push({
      tableName: 'trades',
      columns: ['sellerId', 'timestamp'],
      reason: 'Optimize seller trade history queries',
    });

    // Portfolio table composite indexes
    compositeIndexes.push({
      tableName: 'portfolio',
      columns: ['userId', 'asset'],
      reason: 'Optimize user portfolio lookups',
    });

    // Balance table composite indexes
    compositeIndexes.push({
      tableName: 'user_balance',
      columns: ['userId', 'asset'],
      reason: 'Optimize user balance queries',
    });

    return compositeIndexes;
  }

  private async createIndex(
    recommendation: IndexRecommendation,
  ): Promise<void> {
    const indexName = `idx_${recommendation.tableName}_${recommendation.columnName}`;
    let createQuery = '';

    if (this.dataSource.options.type === 'postgres') {
      switch (recommendation.indexType) {
        case 'btree':
          createQuery = `CREATE INDEX CONCURRENTLY ${indexName} ON ${recommendation.tableName} (${recommendation.columnName})`;
          break;
        case 'hash':
          createQuery = `CREATE INDEX CONCURRENTLY ${indexName} ON ${recommendation.tableName} USING HASH (${recommendation.columnName})`;
          break;
        case 'partial':
          createQuery = `CREATE INDEX CONCURRENTLY ${indexName} ON ${recommendation.tableName} (${recommendation.columnName}) WHERE ${recommendation.columnName} IS NOT NULL`;
          break;
      }
    } else if (this.dataSource.options.type === 'sqlite') {
      createQuery = `CREATE INDEX ${indexName} ON ${recommendation.tableName} (${recommendation.columnName})`;
    }

    if (createQuery) {
      await this.dataSource.query(createQuery);
    }
  }

  private getCommonWhereColumns(tableName: string): string[] {
    const commonPatterns: Record<string, string[]> = {
      trades: ['userId', 'asset', 'status', 'buyerId', 'sellerId'],
      portfolio: ['userId', 'asset'],
      user_balance: ['userId', 'asset'],
      order_book: ['asset', 'status', 'userId'],
      virtual_asset: ['symbol'],
    };

    return commonPatterns[tableName] || [];
  }

  private getCommonOrderByColumns(tableName: string): string[] {
    const commonPatterns: Record<string, string[]> = {
      trades: ['timestamp', 'createdAt'],
      order_book: ['price', 'createdAt'],
      portfolio: ['updatedAt'],
      user_balance: ['updatedAt'],
    };

    return commonPatterns[tableName] || [];
  }

  private extractColumnsFromIndexDef(indexDef: string): string[] {
    const match = indexDef.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map((col) => col.trim().replace(/"/g, ''));
    }
    return [];
  }

  private analyzePostgresPlan(plan: any[]): any {
    if (plan && plan.length > 0 && plan[0]['Plan']) {
      const executionPlan = plan[0]['Plan'];
      return {
        totalCost: executionPlan['Total Cost'],
        actualTime: executionPlan['Actual Total Time'],
        planningTime: plan[0]['Planning Time'],
        executionTime: plan[0]['Execution Time'],
        indexUsage: this.extractIndexUsage(executionPlan),
        nodeTypes: this.extractNodeTypes(executionPlan),
      };
    }
    return null;
  }

  private analyzeSQLitePlan(plan: any[]): any {
    return {
      plan: plan,
      indexUsage: plan.some(
        (row) => row.detail && row.detail.includes('USING INDEX'),
      ),
      details: plan,
    };
  }

  private extractIndexUsage(node: any): {
    indexesUsed: string[];
    sequentialScans: number;
    indexScans: number;
  } {
    const usage = {
      indexesUsed: [] as string[],
      sequentialScans: 0,
      indexScans: 0,
    };

    if (node['Node Type'] === 'Index Scan') {
      usage.indexScans++;
      usage.indexesUsed.push(node['Index Name']);
    } else if (node['Node Type'] === 'Seq Scan') {
      usage.sequentialScans++;
    }

    if (node['Plans']) {
      for (const plan of node['Plans']) {
        const childUsage = this.extractIndexUsage(plan);
        usage.indexesUsed.push(...childUsage.indexesUsed);
        usage.sequentialScans += childUsage.sequentialScans;
        usage.indexScans += childUsage.indexScans;
      }
    }

    return usage;
  }

  private extractNodeTypes(node: any): string[] {
    const types = [node['Node Type']];

    if (node['Plans']) {
      for (const plan of node['Plans']) {
        types.push(...this.extractNodeTypes(plan));
      }
    }

    return types;
  }
}
