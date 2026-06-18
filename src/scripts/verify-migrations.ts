import { DataSource } from 'typeorm';
import { AppDataSource } from '../database/data-source';

async function verifyMigrations() {
  console.log('🔍 Starting Migration Verification...');

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('✅ Database connection established');

    // Get all migrations registered in code
    const allMigrations = AppDataSource.migrations;
    console.log(`📂 Found ${allMigrations.length} migrations in codebase`);

    // Get executed migrations from DB
    const queryRunner = AppDataSource.createQueryRunner();
    const executedMigrations = await queryRunner.getExecutedMigrations();
    await queryRunner.release();

    console.log(
      `🗄️  Found ${executedMigrations.length} executed migrations in database`,
    );

    const executedNames = new Set(executedMigrations.map((m) => m.name));
    const pendingMigrations = allMigrations.filter(
      (m) => !executedNames.has(m.constructor.name),
    );

    if (pendingMigrations.length > 0) {
      console.warn(
        `⚠️  ${pendingMigrations.length} Pending migrations detected:`,
      );
      pendingMigrations.forEach((m) =>
        console.warn(`   - ${m.constructor.name}`),
      );
      process.exitCode = 1;
    } else {
      console.log('✅ No pending migrations. Schema is up to date.');
    }

    // Check for migrations in DB that are missing from code (integrity check)
    const codeNames = new Set(allMigrations.map((m) => m.constructor.name));
    const missingMigrations = executedMigrations.filter(
      (m) => !codeNames.has(m.name),
    );

    if (missingMigrations.length > 0) {
      console.error(
        `❌ ${missingMigrations.length} migrations found in DB but missing from code (possible code rollback or history mismatch):`,
      );
      missingMigrations.forEach((m) => console.error(`   - ${m.name}`));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

verifyMigrations();
