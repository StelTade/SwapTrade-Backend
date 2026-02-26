import type { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { MetricsService } from './metrics.service';

export class MetricsTypeOrmLogger implements TypeOrmLogger {
  constructor(private readonly metricsService: MetricsService) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    const operation = this.getOperation(query);
    this.metricsService.recordDbQuery(operation, true);
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    const operation = this.getOperation(query);
    this.metricsService.recordDbQuery(operation, false);
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    const operation = this.getOperation(query);
    this.metricsService.recordSlowDbQuery(operation, time);
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner): void {
    return;
  }

  logMigration(message: string, queryRunner?: QueryRunner): void {
    return;
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): void {
    return;
  }

  private getOperation(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
      return 'unknown';
    }
    const operation = trimmed.split(' ')[0].toLowerCase();
    switch (operation) {
      case 'select':
      case 'insert':
      case 'update':
      case 'delete':
      case 'create':
      case 'drop':
        return operation;
      default:
        return 'other';
    }
  }
}
