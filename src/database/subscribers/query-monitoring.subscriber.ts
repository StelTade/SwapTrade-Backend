import {
  EventSubscriber,
  EntitySubscriberInterface,
  DataSource,
} from 'typeorm';
import { Logger } from '@nestjs/common';
import { QueryPerformanceService } from '../services/query-performance.service';

@EventSubscriber()
export class QueryMonitoringSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(QueryMonitoringSubscriber.name);
  private queryCount = 0;
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms

  constructor(
    dataSource: DataSource,
    private readonly queryPerformanceService: QueryPerformanceService,
  ) {
    dataSource.subscribers.push(this);
  }

  /**
   * Called before query execution
   */
  beforeQuery(event: any): Promise<any> | void {
    event.queryStartTime = Date.now();
  }

  /**
   * Called after query execution
   */
  afterQuery(event: any): Promise<any> | void {
    const duration = Date.now() - event.queryStartTime;
    this.queryCount++;

    // Log slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      this.logger.warn(
        `Slow query detected (${duration}ms): ${event.query.substring(0, 200)}...`,
        {
          duration,
          query: event.query,
          parameters: event.parameters,
          queryCount: this.queryCount,
        },
      );

      // Store in performance service
      this.queryPerformanceService.monitorQuery(
        event.query,
        event.parameters,
        () => Promise.resolve(event.result),
        {
          entity: this.extractEntityFromQuery(event.query),
        },
      );
    }

    // Log query statistics periodically
    if (this.queryCount % 100 === 0) {
      this.logger.log(`Processed ${this.queryCount} queries`);
    }
  }

  /**
   * Called when query fails
   */
  queryError(event: any): Promise<any> | void {
    const duration = Date.now() - event.queryStartTime;

    this.logger.error(
      `Query failed after ${duration}ms: ${event.query.substring(0, 200)}...`,
      {
        duration,
        query: event.query,
        parameters: event.parameters,
        error: event.error?.message,
      },
    );
  }

  private extractEntityFromQuery(query: string): string | undefined {
    const upperQuery = query.toUpperCase();

    // Extract table name from FROM clause
    const fromMatch = upperQuery.match(/FROM\s+(\w+)/);
    if (fromMatch) {
      return fromMatch[1].toLowerCase();
    }

    // Extract table name from INSERT INTO
    const insertMatch = upperQuery.match(/INSERT\s+INTO\s+(\w+)/);
    if (insertMatch) {
      return insertMatch[1].toLowerCase();
    }

    // Extract table name from UPDATE
    const updateMatch = upperQuery.match(/UPDATE\s+(\w+)/);
    if (updateMatch) {
      return updateMatch[1].toLowerCase();
    }

    return undefined;
  }
}
