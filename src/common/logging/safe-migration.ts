import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Base class for safe migrations with validation and rollback verification.
 * All production migrations should extend this class.
 */
export abstract class SafeMigration implements MigrationInterface {
  public abstract name?: string;

  /**
   * Execute the migration changes
   */
  protected abstract performUp(queryRunner: QueryRunner): Promise<void>;

  /**
   * Execute the rollback changes
   */
  protected abstract performDown(queryRunner: QueryRunner): Promise<void>;

  /**
   * Validate data integrity after migration
   * Throw error to trigger rollback
   */
  protected async validateUp(queryRunner: QueryRunner): Promise<void> {
    // Optional override: Check if tables exist, data is correct, etc.
  }

  /**
   * Validate data integrity after rollback
   */
  protected async validateDown(queryRunner: QueryRunner): Promise<void> {
    // Optional override: Check if tables are removed, data restored, etc.
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log(`[Migration] Starting UP: ${this.constructor.name}`);
    try {
      await this.performUp(queryRunner);
      console.log(`[Migration] Validating UP: ${this.constructor.name}`);
      await this.validateUp(queryRunner);
      console.log(`[Migration] Success UP: ${this.constructor.name}`);
    } catch (error) {
      console.error(`[Migration] Failed UP: ${this.constructor.name}`, error);
      throw error; // Triggers transaction rollback
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log(`[Migration] Starting DOWN: ${this.constructor.name}`);
    try {
      await this.performDown(queryRunner);
      console.log(`[Migration] Validating DOWN: ${this.constructor.name}`);
      await this.validateDown(queryRunner);
      console.log(`[Migration] Success DOWN: ${this.constructor.name}`);
    } catch (error) {
      console.error(`[Migration] Failed DOWN: ${this.constructor.name}`, error);
      throw error;
    }
  }
}