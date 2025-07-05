import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { OfferInit1703123456789 } from './migrations/1703123456789-OfferInit';

async function runMigration() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  try {
    console.log('Running migration...');
    const migration = new OfferInit1703123456789();
    await migration.up(dataSource.createQueryRunner());
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

runMigration().catch(console.error); 