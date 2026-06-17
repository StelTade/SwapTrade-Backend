import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateReferralSystem1743000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create referral_codes table
    await queryRunner.createTable(
      new Table({
        name: 'referral_codes',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '12',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'expiresAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
        ],
      }),
      true,
    );

    // Create referrals table
    await queryRunner.createTable(
      new Table({
        name: 'referrals',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'referrerId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'referredUserId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'rewardedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'verifiedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create referral_rewards table
    await queryRunner.createTable(
      new Table({
        name: 'referral_rewards',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'referralId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'creditedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create leaderboard_cache table
    await queryRunner.createTable(
      new Table({
        name: 'leaderboard_cache',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'score',
            type: 'decimal',
            precision: 18,
            scale: 8,
            default: 0,
          },
          {
            name: 'rank',
            type: 'integer',
            default: 0,
          },
          {
            name: 'period',
            type: 'varchar',
            length: '20',
            default: "'ALL_TIME'",
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'periodStart',
            type: 'datetime',
            isNullable: false,
          },
          {
            name: 'periodEnd',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create waitlist_users table
    await queryRunner.createTable(
      new Table({
        name: 'waitlist_users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'pending'",
          },
          {
            name: 'referralCode',
            type: 'varchar',
            length: '12',
            isNullable: true,
          },
          {
            name: 'referralSource',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'verifiedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'invitedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create waitlist_verification_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'waitlist_verification_tokens',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'token',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'expiresAt',
            type: 'datetime',
            isNullable: false,
          },
          {
            name: 'isUsed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'usedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'referral_codes',
      new TableIndex({
        name: 'IDX_referral_codes_code',
        columnNames: ['code'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'referral_codes',
      new TableIndex({
        name: 'IDX_referral_codes_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_referrals_referrerId',
        columnNames: ['referrerId'],
      }),
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_referrals_referredUserId',
        columnNames: ['referredUserId'],
      }),
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_referrals_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'referrals',
      new TableIndex({
        name: 'IDX_referrals_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'referral_rewards',
      new TableIndex({
        name: 'IDX_referral_rewards_referralId',
        columnNames: ['referralId'],
      }),
    );

    await queryRunner.createIndex(
      'referral_rewards',
      new TableIndex({
        name: 'IDX_referral_rewards_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'referral_rewards',
      new TableIndex({
        name: 'IDX_referral_rewards_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'leaderboard_cache',
      new TableIndex({
        name: 'IDX_leaderboard_cache_type_period_rank',
        columnNames: ['type', 'period', 'rank'],
      }),
    );

    await queryRunner.createIndex(
      'leaderboard_cache',
      new TableIndex({
        name: 'IDX_leaderboard_cache_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_users',
      new TableIndex({
        name: 'IDX_waitlist_users_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'waitlist_users',
      new TableIndex({
        name: 'IDX_waitlist_users_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_users',
      new TableIndex({
        name: 'IDX_waitlist_users_referralCode',
        columnNames: ['referralCode'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_users',
      new TableIndex({
        name: 'IDX_waitlist_users_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_verification_tokens',
      new TableIndex({
        name: 'IDX_waitlist_tokens_token',
        columnNames: ['token'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'waitlist_verification_tokens',
      new TableIndex({
        name: 'IDX_waitlist_tokens_email',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'waitlist_verification_tokens',
      new TableIndex({
        name: 'IDX_waitlist_tokens_expiresAt',
        columnNames: ['expiresAt'],
      }),
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'referral_codes',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'referrals',
      new TableForeignKey({
        columnNames: ['referrerId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'referrals',
      new TableForeignKey({
        columnNames: ['referredUserId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'referral_rewards',
      new TableForeignKey({
        columnNames: ['referralId'],
        referencedTableName: 'referrals',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'waitlist_verification_tokens',
      new TableForeignKey({
        columnNames: ['email'],
        referencedTableName: 'waitlist_users',
        referencedColumnNames: ['email'],
        onDelete: 'CASCADE',
      }),
    );

    // Create unique constraint on leaderboard_cache
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_leaderboard_cache_unique" 
      ON "leaderboard_cache" ("type", "period", "userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey(
      'waitlist_verification_tokens',
      'FK_waitlist_tokens_email',
    );
    await queryRunner.dropForeignKey(
      'referral_rewards',
      'FK_referral_rewards_referralId',
    );
    await queryRunner.dropForeignKey(
      'referrals',
      'FK_referrals_referredUserId',
    );
    await queryRunner.dropForeignKey('referrals', 'FK_referrals_referrerId');
    await queryRunner.dropForeignKey(
      'referral_codes',
      'FK_referral_codes_userId',
    );

    // Drop indexes
    await queryRunner.dropIndex(
      'waitlist_verification_tokens',
      'IDX_waitlist_tokens_expiresAt',
    );
    await queryRunner.dropIndex(
      'waitlist_verification_tokens',
      'IDX_waitlist_tokens_email',
    );
    await queryRunner.dropIndex(
      'waitlist_verification_tokens',
      'IDX_waitlist_tokens_token',
    );
    await queryRunner.dropIndex(
      'waitlist_users',
      'IDX_waitlist_users_createdAt',
    );
    await queryRunner.dropIndex(
      'waitlist_users',
      'IDX_waitlist_users_referralCode',
    );
    await queryRunner.dropIndex('waitlist_users', 'IDX_waitlist_users_status');
    await queryRunner.dropIndex('waitlist_users', 'IDX_waitlist_users_email');
    await queryRunner.dropIndex(
      'leaderboard_cache',
      'IDX_leaderboard_cache_userId',
    );
    await queryRunner.dropIndex(
      'leaderboard_cache',
      'IDX_leaderboard_cache_type_period_rank',
    );
    await queryRunner.dropIndex(
      'referral_rewards',
      'IDX_referral_rewards_createdAt',
    );
    await queryRunner.dropIndex(
      'referral_rewards',
      'IDX_referral_rewards_type',
    );
    await queryRunner.dropIndex(
      'referral_rewards',
      'IDX_referral_rewards_referralId',
    );
    await queryRunner.dropIndex('referrals', 'IDX_referrals_createdAt');
    await queryRunner.dropIndex('referrals', 'IDX_referrals_status');
    await queryRunner.dropIndex('referrals', 'IDX_referrals_referredUserId');
    await queryRunner.dropIndex('referrals', 'IDX_referrals_referrerId');
    await queryRunner.dropIndex('referral_codes', 'IDX_referral_codes_userId');
    await queryRunner.dropIndex('referral_codes', 'IDX_referral_codes_code');

    // Drop tables
    await queryRunner.dropTable('waitlist_verification_tokens');
    await queryRunner.dropTable('waitlist_users');
    await queryRunner.dropTable('leaderboard_cache');
    await queryRunner.dropTable('referral_rewards');
    await queryRunner.dropTable('referrals');
    await queryRunner.dropTable('referral_codes');
  }
}
