import { MigrationInterface, QueryRunner } from "typeorm";

export class OfferInit1703123456789 implements MigrationInterface {
    name = 'OfferInit1703123456789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."offer_status_enum" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'expired')
        `);
        
        await queryRunner.query(`
            CREATE TABLE "offer" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "offeredAssetId" integer NOT NULL,
                "requestedAssetId" integer NOT NULL,
                "initiatorId" integer NOT NULL,
                "recipientId" integer NOT NULL,
                "status" "public"."offer_status_enum" NOT NULL DEFAULT 'pending',
                "offeredAmount" numeric(18,8),
                "requestedAmount" numeric(18,8),
                "message" text,
                "expiresAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_offer_id" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_offer_initiator_status" ON "offer" ("initiatorId", "status")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_offer_recipient_status" ON "offer" ("recipientId", "status")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_offer_assets" ON "offer" ("offeredAssetId", "requestedAssetId")
        `);
        
        await queryRunner.query(`
            ALTER TABLE "offer" ADD CONSTRAINT "FK_offer_initiator" 
            FOREIGN KEY ("initiatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        
        await queryRunner.query(`
            ALTER TABLE "offer" ADD CONSTRAINT "FK_offer_recipient" 
            FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        
        await queryRunner.query(`
            ALTER TABLE "offer" ADD CONSTRAINT "FK_offer_offered_asset" 
            FOREIGN KEY ("offeredAssetId") REFERENCES "portfolio"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        
        await queryRunner.query(`
            ALTER TABLE "offer" ADD CONSTRAINT "FK_offer_requested_asset" 
            FOREIGN KEY ("requestedAssetId") REFERENCES "portfolio"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT "FK_offer_requested_asset"`);
        await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT "FK_offer_offered_asset"`);
        await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT "FK_offer_recipient"`);
        await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT "FK_offer_initiator"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_assets"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_recipient_status"`);
        await queryRunner.query(`DROP INDEX "IDX_offer_initiator_status"`);
        await queryRunner.query(`DROP TABLE "offer"`);
        await queryRunner.query(`DROP TYPE "public"."offer_status_enum"`);
    }
} 