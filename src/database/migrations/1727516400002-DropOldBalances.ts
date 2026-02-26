import { MigrationInterface, QueryRunner } from "typeorm";

export class DropOldBalances1727516400002 implements MigrationInterface {
    name = 'DropOldBalances1727516400002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists before dropping to avoid errors if it was never created or already dropped
        const tableExists = await queryRunner.hasTable("balance");
        if (tableExists) {
            await queryRunner.query(`DROP TABLE "balance"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "balance" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" varchar NOT NULL, "asset" varchar NOT NULL, "balance" decimal NOT NULL)`);
    }
}
