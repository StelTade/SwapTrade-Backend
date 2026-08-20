import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wallet & Payments Integration schema. Postgres-flavored, mirroring the style
 * of {@link CreateBlockchainTables1750700000000}. Dev SQLite relies on
 * TypeORM `synchronize` instead of this migration.
 */
export class CreateWalletTables1750800000000 implements MigrationInterface {
  name = 'CreateWalletTables1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── wallet_ledgers ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "wallet_ledgers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "available" numeric(18,8) NOT NULL DEFAULT 0,
        "reserved" numeric(18,8) NOT NULL DEFAULT 0,
        "version" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_ledgers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wl_userId" ON "wallet_ledgers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_wl_userId_asset" ON "wallet_ledgers" ("userId", "asset")`,
    );

    // ── ledger_entries ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "entryType" character varying NOT NULL,
        "amount" numeric(18,8) NOT NULL,
        "availableDelta" numeric(18,8) NOT NULL DEFAULT 0,
        "reservedDelta" numeric(18,8) NOT NULL DEFAULT 0,
        "balanceAfterAvailable" numeric(18,8) NOT NULL,
        "balanceAfterReserved" numeric(18,8) NOT NULL,
        "referenceType" character varying,
        "referenceId" character varying,
        "idempotencyKey" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_entries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_le_idempotencyKey" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_le_userId" ON "ledger_entries" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_le_userId_asset" ON "ledger_entries" ("userId", "asset")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_le_reference" ON "ledger_entries" ("referenceType", "referenceId")`,
    );

    // ── withdrawal_requests ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "withdrawal_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "network" character varying NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "amount" numeric(18,8) NOT NULL,
        "toAddress" character varying NOT NULL,
        "memo" character varying,
        "status" character varying NOT NULL DEFAULT 'queued',
        "requiresApproval" boolean NOT NULL DEFAULT false,
        "approvedBy" character varying,
        "approvedAt" TIMESTAMP,
        "rejectedReason" character varying,
        "txHash" character varying,
        "blockchainTxId" character varying,
        "confirmations" integer NOT NULL DEFAULT 0,
        "errorMessage" character varying,
        "attempts" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_withdrawal_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_wr_userId" ON "withdrawal_requests" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wr_status" ON "withdrawal_requests" ("status")`,
    );

    // ── fiat_payment_intents ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "fiat_payment_intents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "direction" character varying NOT NULL,
        "provider" character varying NOT NULL,
        "providerRef" character varying,
        "currency" character varying NOT NULL DEFAULT 'USD',
        "amount" numeric(18,8) NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "status" character varying NOT NULL DEFAULT 'created',
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fiat_payment_intents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_fpi_userId" ON "fiat_payment_intents" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fpi_status" ON "fiat_payment_intents" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fiat_payment_intents"`);
    await queryRunner.query(`DROP TABLE "withdrawal_requests"`);
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP TABLE "wallet_ledgers"`);
  }
}
