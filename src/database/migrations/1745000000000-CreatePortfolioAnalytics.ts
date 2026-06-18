import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePortfolioAnalytics1745000000000 implements MigrationInterface {
  name = 'CreatePortfolioAnalytics1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create portfolio_snapshot table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "portfolio_snapshot" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "userId" integer NOT NULL,
        "totalValue" decimal(20,8) NOT NULL,
        "previousValue" decimal(20,8),
        "profitLoss" decimal(10,4),
        "returns" decimal(10,4),
        "assetAllocation" json,
        "assetValues" json,
        "timestamp" datetime NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_portfolio_snapshot_userId_timestamp" ON "portfolio_snapshot" ("userId", "timestamp")
    `);

    // Create risk_metrics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "risk_metrics" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "userId" integer NOT NULL,
        "var95" decimal(10,4),
        "var99" decimal(10,4),
        "sharpeRatio" decimal(10,4),
        "sortinoRatio" decimal(10,4),
        "calmarRatio" decimal(10,4),
        "maxDrawdown" decimal(10,4),
        "currentDrawdown" decimal(10,4),
        "maxDrawdownDuration" integer,
        "volatility" decimal(10,4),
        "annualizedVolatility" decimal(10,4),
        "beta" decimal(10,4),
        "alpha" decimal(10,4),
        "benchmark" varchar,
        "calculatedAt" datetime NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_risk_metrics_userId" ON "risk_metrics" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_risk_metrics_calculatedAt" ON "risk_metrics" ("calculatedAt")
    `);

    // Create performance_history table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "performance_history" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "userId" integer NOT NULL,
        "period" varchar NOT NULL,
        "date" datetime NOT NULL,
        "startValue" decimal(20,8) NOT NULL,
        "endValue" decimal(20,8) NOT NULL,
        "return" decimal(10,4),
        "benchmarkReturn" decimal(10,4),
        "excessReturn" decimal(10,4),
        "attribution" json,
        "tradingDays" integer,
        "totalTrades" integer,
        "winRate" decimal(10,4),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_performance_history_userId" ON "performance_history" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_performance_history_period" ON "performance_history" ("period")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_performance_history_date" ON "performance_history" ("date")
    `);

    // Create benchmark table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "benchmark" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "symbol" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "value" decimal(20,8) NOT NULL,
        "dailyReturn" decimal(10,4),
        "historicalData" json,
        "isActive" boolean NOT NULL DEFAULT (1),
        "date" datetime NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benchmark_symbol" ON "benchmark" ("symbol")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_benchmark_date" ON "benchmark" ("date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_benchmark_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_benchmark_symbol"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "benchmark"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_performance_history_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_performance_history_period"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_performance_history_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "performance_history"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_risk_metrics_calculatedAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_risk_metrics_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "risk_metrics"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_portfolio_snapshot_userId_timestamp"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "portfolio_snapshot"`);
  }
}
