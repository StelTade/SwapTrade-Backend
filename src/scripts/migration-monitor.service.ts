import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface MigrationStatus {
  total: number;
  executed: number;
  pending: number;
  isSynced: boolean;
  lastMigration?: string;
  pendingList: string[];
}

@Injectable()
export class MigrationMonitorService {
  private readonly logger = new Logger(MigrationMonitorService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const allMigrations = this.dataSource.migrations;
      const queryRunner = this.dataSource.createQueryRunner();
      const executedMigrations = await queryRunner.getExecutedMigrations();
      await queryRunner.release();

      const executedNames = new Set(executedMigrations.map((m) => m.name));
      const pendingMigrations = allMigrations.filter(
        (m) => !executedNames.has(m.constructor.name),
      );

      return {
        total: allMigrations.length,
        executed: executedMigrations.length,
        pending: pendingMigrations.length,
        isSynced: pendingMigrations.length === 0,
        lastMigration: executedMigrations.length > 0 ? executedMigrations[executedMigrations.length - 1].name : undefined,
        pendingList: pendingMigrations.map(m => m.constructor.name),
      };
    } catch (error) {
      this.logger.error('Failed to check migration status', error);
      throw error;
    }
  }
}