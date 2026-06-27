import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrossChainBridgeTable1750700100000 implements MigrationInterface {
  name = 'CreateCrossChainBridgeTable1750700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(
      `CREATE INDEX "IDX_ccb_userId" ON "cross_chain_bridges" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ccb_status" ON "cross_chain_bridges" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ccb_status"`);
    await queryRunner.query(`DROP INDEX "IDX_ccb_userId"`);
    await queryRunner.query(`DROP TABLE "cross_chain_bridges"`);
  }
}
