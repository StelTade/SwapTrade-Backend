import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMobileTables1750100000000 implements MigrationInterface {
  name = 'CreateMobileTables1750100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mobile_devices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "fcmToken" character varying NOT NULL,
        "platform" character varying NOT NULL,
        "deviceModel" character varying,
        "osVersion" character varying,
        "appVersion" character varying,
        "notificationsEnabled" boolean NOT NULL DEFAULT true,
        "lastSeenAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mobile_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mobile_devices_fcmToken" UNIQUE ("fcmToken")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_devices_userId" ON "mobile_devices" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_devices_fcmToken" ON "mobile_devices" ("fcmToken")`,
    );

    await queryRunner.query(`
      CREATE TABLE "app_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "platform" character varying NOT NULL,
        "version" character varying NOT NULL,
        "minimumVersion" character varying NOT NULL,
        "forceUpdate" boolean NOT NULL DEFAULT false,
        "updateMessage" character varying,
        "storeUrl" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_versions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "offline_sync_queue" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "payload" jsonb NOT NULL,
        "checksum" character varying,
        "retryCount" integer NOT NULL DEFAULT 0,
        "errorMessage" character varying,
        "syncedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offline_sync_queue" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_offline_sync_userId_status" ON "offline_sync_queue" ("userId", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "mobile_analytics_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying,
        "eventName" character varying NOT NULL,
        "platform" character varying,
        "appVersion" character varying,
        "screenName" character varying,
        "properties" jsonb,
        "sessionId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mobile_analytics_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_analytics_userId_event" ON "mobile_analytics_events" ("userId", "eventName")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_analytics_createdAt" ON "mobile_analytics_events" ("createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mobile_analytics_events"`);
    await queryRunner.query(`DROP TABLE "offline_sync_queue"`);
    await queryRunner.query(`DROP TABLE "app_versions"`);
    await queryRunner.query(`DROP TABLE "mobile_devices"`);
  }
}
