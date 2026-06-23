import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlockchainTables1750700000000 implements MigrationInterface {
  name = 'CreateBlockchainTables1750700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blockchain_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "network" character varying NOT NULL,
        "type" character varying NOT NULL,
        "status" character varying NOT NULL,
        "txHash" character varying,
        "fromAddress" character varying NOT NULL,
        "toAddress" character varying NOT NULL,
        "amount" numeric(18,8) NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "memo" character varying,
        "confirmations" integer NOT NULL DEFAULT 0,
        "errorMessage" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blockchain_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_bt_userId" ON "blockchain_transactions" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bt_txHash" ON "blockchain_transactions" ("txHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_bt_status" ON "blockchain_transactions" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "wallet_addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "network" character varying NOT NULL,
        "address" character varying NOT NULL,
        "encryptedPrivateKey" character varying NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_wallet_address" UNIQUE ("address"),
        CONSTRAINT "UQ_wallet_user_network" UNIQUE ("userId", "network"),
        CONSTRAINT "PK_wallet_addresses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_wa_userId" ON "wallet_addresses" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "cross_chain_bridges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "sourceNetwork" character varying NOT NULL,
        "destinationNetwork" character varying NOT NULL,
        "sourceAddress" character varying NOT NULL,
        "destinationAddress" character varying NOT NULL,
        "amount" numeric(18,8) NOT NULL,
        "asset" character varying NOT NULL DEFAULT 'USDC',
        "status" character varying NOT NULL DEFAULT 'initiated',
        "sourceTxHash" character varying,
        "destinationTxHash" character varying,
        "multisigApprovals" integer NOT NULL DEFAULT 0,
        "multisigThreshold" integer NOT NULL DEFAULT 2,
        "errorMessage" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cross_chain_bridges" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ccb_userId" ON "cross_chain_bridges" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_ccb_status" ON "cross_chain_bridges" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cross_chain_bridges"`);
    await queryRunner.query(`DROP TABLE "wallet_addresses"`);
    await queryRunner.query(`DROP TABLE "blockchain_transactions"`);
  }
}
