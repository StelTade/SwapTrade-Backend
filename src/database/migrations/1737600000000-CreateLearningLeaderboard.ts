import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLearningLeaderboard1737600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create learning_profiles table
    await queryRunner.createTable(
      new Table({
        name: 'learning_profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'int',
            isUnique: true,
          },
          {
            name: 'total_points',
            type: 'int',
            default: 0,
          },
          {
            name: 'tutorials_completed',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_quiz_score',
            type: 'int',
            default: 0,
          },
          {
            name: 'average_quiz_score',
            type: 'int',
            default: 0,
          },
          {
            name: 'current_streak',
            type: 'int',
            default: 0,
          },
          {
            name: 'longest_streak',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_activity_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'consecutive_days',
            type: 'int',
            default: 0,
          },
          {
            name: 'completed_modules',
            type: 'jsonb',
            default: '[]',
          },
          {
            name: 'module_scores',
            type: 'jsonb',
            default: '{}',
          },
          {
            name: 'earned_badges',
            type: 'jsonb',
            default: '[]',
          },
          {
            name: 'learning_level',
            type: 'varchar',
            length: '50',
            default: "'BEGINNER'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'last_calculated_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add indexes for performance
    await queryRunner.createIndex(
      'learning_profiles',
      new TableIndex({
        name: 'IDX_learning_profiles_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'learning_profiles',
      new TableIndex({
        name: 'IDX_learning_profiles_total_points',
        columnNames: ['total_points'],
      }),
    );

    // Add quiz_score column to tutorial_progress table
    await queryRunner.query(`
      ALTER TABLE "tutorial_progress" 
      ADD COLUMN IF NOT EXISTS "quiz_score" integer DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex(
      'learning_profiles',
      'IDX_learning_profiles_user_id',
    );
    await queryRunner.dropIndex(
      'learning_profiles',
      'IDX_learning_profiles_total_points',
    );

    // Drop learning_profiles table
    await queryRunner.dropTable('learning_profiles');

    // Remove quiz_score column from tutorial_progress
    await queryRunner.query(`
      ALTER TABLE "tutorial_progress" 
      DROP COLUMN IF EXISTS "quiz_score"
    `);
  }
}
