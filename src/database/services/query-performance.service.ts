import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

interface SlowQueryLog {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  userId?: string;
  entity?: string;
}

interface QueryPerformanceMetrics {
  totalQueries: number;
  slowQueries: number;
  averageDuration: number;
  slowestQueries: SlowQueryLog[];
}

@Injectable()
export class QueryPerformanceService {
  private readonly logger = new Logger(QueryPerformanceService.name);
  private readonly slowQueries: SlowQueryLog[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms
  private readonly MAX_SLOW_QUERIES_LOG = 1000;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Monitor query execution and log slow queries
   */
  async monitorQuery<T>(
    query: string,
    parameters: any[] = [],
    executor: () => Promise<T>,
    context?: { userId?: string; entity?: string },
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await executor();
      const duration = Date.now() - startTime;

      if (duration > this.SLOW_QUERY_THRESHOLD) {
        this.logSlowQuery(query, duration, parameters, context);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Query failed after ${duration}ms: ${query}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Execute EXPLAIN ANALYZE for PostgreSQL queries
   */
  async explainQuery(query: string, parameters: any[] = []): Promise<any> {
    try {
      // For PostgreSQL
      if (this.dataSource.options.type === 'postgres') {
        const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
        const result = await this.dataSource.query(explainQuery, parameters);
        return result;
      }

      // For SQLite - use EXPLAIN QUERY PLAN
      if (this.dataSource.options.type === 'sqlite') {
        const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
        const result = await this.dataSource.query(explainQuery, parameters);
        return result;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to explain query: ${query}`, error.stack);
      return null;
    }
  }

  /**
   * Get performance metrics for all queries
   */
  getPerformanceMetrics(): QueryPerformanceMetrics {
    const slowQueries = this.slowQueries.slice(-50); // Last 50 slow queries
    const totalQueries = this.slowQueries.length;
    const averageDuration =
      slowQueries.length > 0
        ? slowQueries.reduce((sum, q) => sum + q.duration, 0) /
          slowQueries.length
        : 0;

    return {
      totalQueries,
      slowQueries: slowQueries.length,
      averageDuration,
      slowestQueries: slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
    };
  }

  /**
   * Get slow queries by entity
   */
  getSlowQueriesByEntity(entityName: string): SlowQueryLog[] {
    return this.slowQueries.filter((q) => q.entity === entityName);
  }

  /**
   * Get slow queries by user
   */
  getSlowQueriesByUser(userId: string): SlowQueryLog[] {
    return this.slowQueries.filter((q) => q.userId === userId);
  }

  /**
   * Analyze query patterns and suggest optimizations
   */
  analyzeQueryPatterns(): {
    recommendations: string[];
    highFrequencyQueries: SlowQueryLog[];
    missingIndexes: string[];
  } {
    const recommendations: string[] = [];
    const highFrequencyQueries = this.findHighFrequencyQueries();
    const missingIndexes = this.findMissingIndexes();

    // Analyze patterns
    const whereHeavyQueries = this.slowQueries.filter(
      (q) => q.query.toLowerCase().includes('where') && q.duration > 200,
    );

    if (whereHeavyQueries.length > 0) {
      recommendations.push('Consider adding indexes on WHERE clause columns');
    }

    const joinHeavyQueries = this.slowQueries.filter(
      (q) => q.query.toLowerCase().includes('join') && q.duration > 300,
    );

    if (joinHeavyQueries.length > 0) {
      recommendations.push(
        'Consider optimizing JOIN operations and adding composite indexes',
      );
    }

    const orderHeavyQueries = this.slowQueries.filter(
      (q) => q.query.toLowerCase().includes('order by') && q.duration > 150,
    );

    if (orderHeavyQueries.length > 0) {
      recommendations.push('Consider adding indexes on ORDER BY columns');
    }

    return {
      recommendations,
      highFrequencyQueries,
      missingIndexes,
    };
  }

  /**
   * Clear slow query logs
   */
  clearSlowQueryLogs(): void {
    this.slowQueries.length = 0;
    this.logger.log('Slow query logs cleared');
  }

  private logSlowQuery(
    query: string,
    duration: number,
    parameters?: any[],
    context?: { userId?: string; entity?: string },
  ): void {
    const slowQuery: SlowQueryLog = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      parameters,
      userId: context?.userId,
      entity: context?.entity,
    };

    this.slowQueries.push(slowQuery);

    // Keep only the last MAX_SLOW_QUERIES_LOG entries
    if (this.slowQueries.length > this.MAX_SLOW_QUERIES_LOG) {
      this.slowQueries.splice(
        0,
        this.slowQueries.length - this.MAX_SLOW_QUERIES_LOG,
      );
    }

    this.logger.warn(
      `Slow query detected (${duration}ms): ${slowQuery.query.substring(0, 200)}...`,
      { duration, parameters, context },
    );
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data and limit length
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, 'password=***')
      .substring(0, 500);
  }

  private findHighFrequencyQueries(): SlowQueryLog[] {
    const queryCounts = new Map<
      string,
      { count: number; totalDuration: number; avgDuration: number }
    >();

    this.slowQueries.forEach((query) => {
      const normalized = this.normalizeQuery(query.query);
      const existing = queryCounts.get(normalized) || {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
      };

      queryCounts.set(normalized, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + query.duration,
        avgDuration:
          (existing.totalDuration + query.duration) / (existing.count + 1),
      });
    });

    return Array.from(queryCounts.entries())
      .filter(([, stats]) => stats.count > 5) // High frequency = >5 executions
      .map(([query, stats]) => ({
        query,
        duration: stats.avgDuration,
        timestamp: new Date(),
        entity: undefined,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  private findMissingIndexes(): string[] {
    const missingIndexes: string[] = [];

    this.slowQueries.forEach((slowQuery) => {
      const query = slowQuery.query.toLowerCase();

      // Look for WHERE clauses on columns that might need indexes
      const whereMatch = query.match(/where\s+([^ ]+)\s*=/i);
      if (whereMatch && !query.includes('index')) {
        missingIndexes.push(`Consider adding index on ${whereMatch[1]}`);
      }

      // Look for ORDER BY clauses
      const orderByMatch = query.match(/order\s+by\s+([^ ]+)/i);
      if (orderByMatch && !query.includes('index')) {
        missingIndexes.push(
          `Consider adding index on ${orderByMatch[1]} for ORDER BY`,
        );
      }
    });

    return [...new Set(missingIndexes)]; // Remove duplicates
  }

  private normalizeQuery(query: string): string {
    // Remove parameters and normalize whitespace for pattern matching
    return query
      .replace(/\$\d+/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
