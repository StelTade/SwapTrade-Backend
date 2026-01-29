import { DataSource } from 'typeorm';
import { AppDataSource } from '../database/data-source';

async function verifyMigrations() {
  await AppDataSource.initialize();

  const pending = await AppDataSource.showMigrations();

  if (pending) {
    console.log('⚠️ Pending migrations detected');
  } else {
    console.log('✅ No pending migrations');
  }

  await AppDataSource.destroy();
}

verifyMigrations().catch((err) => {
  console.error('Migration verification failed', err);
  process.exit(1);
});
