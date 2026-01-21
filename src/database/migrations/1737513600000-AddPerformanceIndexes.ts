import { MigrationInterface, QueryRunner, Index } from 'typeorm';

export class AddPerformanceIndexes1737513600000 implements MigrationInterface {
    name = 'AddPerformanceIndexes1737513600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // User table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_id" ON "user" ("id");
        `);

        // Balance table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_balance_userId" ON "balances" ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_balance_asset" ON "balances" ("asset");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_balance_userId_asset" ON "balances" ("userId", "asset");
        `);

        // UserBalance table indexes (already has some, adding missing ones)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_balance_userId" ON "user_balances" ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_balance_assetId" ON "user_balances" ("assetId");
        `);

        // Trade table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_trade_userId" ON "trade" ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_trade_asset" ON "trade" ("asset");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_trade_createdAt" ON "trade" ("createdAt");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_trade_userId_createdAt" ON "trade" ("userId", "createdAt");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_trade_asset_createdAt" ON "trade" ("asset", "createdAt");
        `);

        // OrderBook table indexes (add missing ones)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_book_userId" ON "order_book" ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_book_createdAt" ON "order_book" ("createdAt");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_book_userId_status" ON "order_book" ("userId", "status");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_book_status_createdAt" ON "order_book" ("status", "createdAt");
        `);

        // Bid table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_userId" ON "bid" ("userId");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_asset" ON "bid" ("asset");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_status" ON "bid" ("status");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_createdAt" ON "bid" ("createdAt");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_userId_status" ON "bid" ("userId", "status");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_asset_status" ON "bid" ("asset", "status");
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_bid_status_createdAt" ON "bid" ("status", "createdAt");
        `);

        // VirtualAsset table indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_virtual_asset_symbol" ON "virtual_assets" ("symbol");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // User table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_id"`);

        // Balance table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_balance_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_balance_asset"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_balance_userId_asset"`);

        // UserBalance table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_balance_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_balance_assetId"`);

        // Trade table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_asset"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_userId_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_asset_createdAt"`);

        // OrderBook table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_book_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_book_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_book_userId_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_book_status_createdAt"`);

        // Bid table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_asset"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_userId_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_asset_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bid_status_createdAt"`);

        // VirtualAsset table indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_virtual_asset_symbol"`);
    }
}
