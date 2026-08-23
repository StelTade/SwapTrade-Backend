import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User Profiles, Linked Wallets, and KYC Documents schema.
 * Postgres-flavored, following the style of CreateWalletTables1750800000000.
 * Dev SQLite relies on TypeORM `synchronize` instead of this migration.
 */
export class CreateUserProfileLinkedWalletKycDocument1750900000000
  implements MigrationInterface
{
  name = 'CreateUserProfileLinkedWalletKycDocument1750900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user_profiles ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "displayName" character varying(50),
        "bio" text,
        "contactEmail" character varying(255),
        "kycStatus" character varying NOT NULL DEFAULT 'none',
        "kycRejectionReason" character varying(100),
        "preferences" text NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_profiles_userId" UNIQUE ("userId")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_up_userId" ON "user_profiles" ("userId")`,
    );

    // ── linked_wallets ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "linked_wallets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "address" character varying NOT NULL,
        "chain" character varying NOT NULL DEFAULT 'ethereum',
        "label" character varying(50),
        "isPrimary" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_linked_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_linked_wallets_userId_address" UNIQUE ("userId", "address")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_lw_userId" ON "linked_wallets" ("userId")`,
    );

    // ── kyc_documents ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "kyc_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying NOT NULL,
        "documentType" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "encryptedData" text NOT NULL,
        "encryptionNonce" character varying NOT NULL,
        "encryptionTag" character varying NOT NULL,
        "encryptedKey" text NOT NULL,
        "originalFilename" character varying,
        "mimeType" character varying(100),
        "fileSizeBytes" integer,
        "rejectionReason" text,
        "reviewedBy" character varying,
        "contentHash" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_kd_userId" ON "kyc_documents" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kd_userId_documentType" ON "kyc_documents" ("userId", "documentType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_kd_userId_status" ON "kyc_documents" ("userId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "kyc_documents"`);
    await queryRunner.query(`DROP TABLE "linked_wallets"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
  }
}
