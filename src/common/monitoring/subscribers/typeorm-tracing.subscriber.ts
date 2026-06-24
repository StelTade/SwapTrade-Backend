import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  QueryRunner,
} from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';

/**
 * TypeOrmTracingSubscriber
 *
 * Uses TypeORM's QueryRunner listener hooks to wrap every database query in
 * an OTel CLIENT span. The span is automatically parented to the active span
 * in the current async context, so it nests under the request SERVER span.
 *
 * Attributes follow OTel semantic conventions:
 *   https://opentelemetry.io/docs/specs/semconv/database/sql/
 */
@Injectable()
@EventSubscriber()
export class TypeOrmTracingSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TypeOrmTracingSubscriber.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    // Register this subscriber with TypeORM
    this.dataSource.subscribers.push(this);
  }

  /**
   * Called immediately before TypeORM sends a query to the database driver.
   * We attach span metadata to the queryRunner so we can retrieve it after.
   */
  beforeQuery(event: {
    query: string;
    parameters?: any[];
    queryRunner?: QueryRunner;
  }): void {
    if (!event.queryRunner) return;

    const tracer = trace.getTracer('swaptrade-backend');
    const operation = this.extractOperation(event.query);
    const table = this.extractTable(event.query);
    const spanName = table ? `${operation} ${table}` : operation;

    const span = tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': this.resolveDbSystem(),
        'db.operation': operation,
        'db.statement': this.sanitiseSql(event.query),
        ...(table ? { 'db.sql.table': table } : {}),
      },
    });

    // Stash span and start time on the QueryRunner for retrieval in afterQuery
    (event.queryRunner as any).__otel_span = span;
    (event.queryRunner as any).__otel_start = Date.now();
  }

  /**
   * Called after the database driver returns a result or throws an error.
   */
  afterQuery(event: {
    query: string;
    parameters?: any[];
    queryRunner?: QueryRunner;
    error?: any;
  }): void {
    if (!event.queryRunner) return;

    const span = (event.queryRunner as any).__otel_span;
    const startTime: number = (event.queryRunner as any).__otel_start;

    if (!span) return;

    const duration = Date.now() - (startTime ?? Date.now());
    span.setAttribute('db.query.duration_ms', duration);

    if (event.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: event.error?.message ?? String(event.error),
      });
      span.recordException(event.error);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();

    // Clean up stashed references
    delete (event.queryRunner as any).__otel_span;
    delete (event.queryRunner as any).__otel_start;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractOperation(query: string): string {
    const trimmed = query.trimStart().toUpperCase();
    for (const op of [
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'DROP',
      'ALTER',
      'BEGIN',
      'COMMIT',
      'ROLLBACK',
    ]) {
      if (trimmed.startsWith(op)) return op;
    }
    return 'QUERY';
  }

  private extractTable(query: string): string | undefined {
    // Very light-touch extraction — only for common DML patterns
    const fromMatch = /\bFROM\s+"?(\w+)"?/i.exec(query);
    if (fromMatch) return fromMatch[1];

    const intoMatch = /\bINTO\s+"?(\w+)"?/i.exec(query);
    if (intoMatch) return intoMatch[1];

    const updateMatch = /\bUPDATE\s+"?(\w+)"?/i.exec(query);
    if (updateMatch) return updateMatch[1];

    return undefined;
  }

  private resolveDbSystem(): string {
    const type = this.dataSource.options.type;
    switch (type) {
      case 'postgres':
        return 'postgresql';
      case 'mysql':
      case 'mariadb':
        return type;
      case 'sqlite':
        return 'sqlite';
      default:
        return type ?? 'other_sql';
    }
  }

  /**
   * Strip literal values from SQL to avoid PII in trace backends.
   */
  private sanitiseSql(query: string): string {
    return query
      .replace(/'[^']*'/g, "'?'")
      .replace(/\b\d+\b/g, '?')
      .substring(0, 1024);
  }
}
