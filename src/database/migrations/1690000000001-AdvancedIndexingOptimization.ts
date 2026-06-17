import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class AdvancedIndexingOptimization1690000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop redundant indexes on trades table
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_asset"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_createdAt"`);

    // Create optimized composite indexes for high-frequency trading queries
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_user_asset_time" 
      ON "trades" ("userId", "asset", "timestamp" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_asset_status_time" 
      ON "trades" ("asset", "status", "timestamp" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_buyer_seller_time" 
      ON "trades" ("buyerId", "sellerId", "timestamp" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_price_volume_time" 
      ON "trades" ("price", "totalValue", "timestamp" DESC)
    `);

    // Partial indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_executed_recent" 
      ON "trades" ("asset", "timestamp" DESC) 
      WHERE "status" = 'EXECUTED' AND "timestamp" > datetime('now', '-24 hours')
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_user_recent" 
      ON "trades" ("userId", "timestamp" DESC) 
      WHERE "timestamp" > datetime('now', '-7 days')
    `);

    // Optimized indexes for user balances
    await queryRunner.query(`
      CREATE INDEX "IDX_balance_user_asset_composite" 
      ON "Balance" ("userId", "assetId", "updatedAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_balance_asset_volume" 
      ON "Balance" ("assetId", "totalTradeVolume" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_balance_active_traders" 
      ON "Balance" ("userId", "totalTrades" DESC, "lastTradeDate" DESC)
    `);

    // Virtual assets indexes for market data queries
    await queryRunner.query(`
      CREATE INDEX "IDX_assets_symbol_updated" 
      ON "virtual_assets" ("symbol", "updatedAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assets_price_range" 
      ON "virtual_assets" ("price")
    `);

    // Create covering indexes for common dashboard queries
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_dashboard_covering" 
      ON "trades" ("userId", "timestamp" DESC) 
      INCLUDE ("asset", "amount", "price", "status", "totalValue")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_balance_portfolio_covering" 
      ON "Balance" ("userId") 
      INCLUDE ("assetId", "balance", "total", "totalInvested", "cumulativePnL")
    `);

    // Create hash indexes for UUID-based lookups (PostgreSQL style, adapted for SQLite)
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_buyer_hash" 
      ON "trades" ("buyerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_seller_hash" 
      ON "trades" ("sellerId")
    `);

    // Time-series partitioning hint indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_time_partition" 
      ON "trades" (strftime('%Y-%m', "timestamp"), "asset", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_balance_time_partition" 
      ON "Balance" (strftime('%Y-%m', "updatedAt"), "userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_user_asset_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_asset_status_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_buyer_seller_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_price_volume_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_executed_recent"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_user_recent"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_balance_user_asset_composite"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_balance_asset_volume"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_balance_active_traders"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_symbol_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_assets_price_range"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_trades_dashboard_covering"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_balance_portfolio_covering"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_buyer_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_seller_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trades_time_partition"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_balance_time_partition"`,
    );

    // Restore original basic indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_trades_userId" ON "trades" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trades_asset" ON "trades" ("asset")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trades_createdAt" ON "trades" ("createdAt")`,
    );
  }
}
