import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class PerformanceOptimizationIndexes1234567890 implements MigrationInterface {
  name = 'PerformanceOptimizationIndexes1234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Trade table indexes for optimal query performance
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_USER_ID_ASSET_TIMESTAMP" 
      ON "trades" ("userId", "asset", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_ASSET_STATUS_TIMESTAMP" 
      ON "trades" ("asset", "status", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_BUYER_ID_TIMESTAMP" 
      ON "trades" ("buyerId", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_SELLER_ID_TIMESTAMP" 
      ON "trades" ("sellerId", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_TYPE_TIMESTAMP" 
      ON "trades" ("type", "timestamp")
    `);

    // Order book table indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_ORDER_BOOK_ASSET_STATUS_PRICE" 
      ON "order_book" ("asset", "status", "price")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_ORDER_BOOK_USER_ID_STATUS" 
      ON "order_book" ("userId", "status")
    `);

    // Portfolio table indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_PORTFOLIO_USER_ID_ASSET" 
      ON "portfolio" ("userId", "asset")
    `);

    // User balance table indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_USER_BALANCE_USER_ID_ASSET" 
      ON "user_balance" ("userId", "asset")
    `);

    // Virtual asset indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_VIRTUAL_ASSET_SYMBOL" 
      ON "virtual_asset" ("symbol")
    `);

    // Notification table indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTIFICATION_USER_ID_CREATED_AT" 
      ON "notifications" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_NOTIFICATION_TYPE_STATUS" 
      ON "notifications" ("type", "status")
    `);

    // Analytics and audit log indexes
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_AUDIT_LOG_USER_ID_TIMESTAMP" 
      ON "audit_log" ("userId", "timestamp")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_AUDIT_LOG_ACTION_TIMESTAMP" 
      ON "audit_log" ("action", "timestamp")
    `);

    // Partial indexes for better performance on active data
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_ACTIVE" 
      ON "trades" ("userId", "timestamp") 
      WHERE "status" != 'COMPLETED'
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_ORDER_BOOK_PENDING" 
      ON "order_book" ("asset", "price") 
      WHERE "status" = 'PENDING'
    `);

    // JSONB indexes for metadata (PostgreSQL specific)
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_TRADES_METADATA_GIN" 
        ON "trades" USING GIN ("metadata")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created indexes
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_USER_ID_ASSET_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_ASSET_STATUS_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_BUYER_ID_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_SELLER_ID_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_TYPE_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_ORDER_BOOK_ASSET_STATUS_PRICE"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_ORDER_BOOK_USER_ID_STATUS"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_PORTFOLIO_USER_ID_ASSET"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_USER_BALANCE_USER_ID_ASSET"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_VIRTUAL_ASSET_SYMBOL"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_NOTIFICATION_USER_ID_CREATED_AT"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_NOTIFICATION_TYPE_STATUS"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_AUDIT_LOG_USER_ID_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_AUDIT_LOG_ACTION_TIMESTAMP"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_ACTIVE"`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "IDX_ORDER_BOOK_PENDING"`,
    );

    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `DROP INDEX CONCURRENTLY IF EXISTS "IDX_TRADES_METADATA_GIN"`,
      );
    }
  }
}
