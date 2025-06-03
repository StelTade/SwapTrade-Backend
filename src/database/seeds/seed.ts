import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeederModule } from './seeder.module';
import { MainSeeder } from './main.seeder';

/**
 * Command-line script to run database seeding
 */
async function bootstrap() {
  const logger = new Logger('Seeder');
  const appContext = await NestFactory.createApplicationContext(SeederModule);

  try {
    const command = process.argv[2];
    const seeder = appContext.get(MainSeeder);

    if (command === 'seed') {
      logger.log('Starting seeding process...');
      await seeder.seed();
      logger.log('Seeding completed successfully');
    } else if (command === 'clear') {
      logger.log('Starting data clearing process...');
      await seeder.clear();
      logger.log('Data clearing completed successfully');
    } else {
      logger.error('Invalid command. Use "seed" or "clear"');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Error during seeding: ${error.message}`, error.stack);
    process.exit(1);
  } finally {
    await appContext.close();
    process.exit(0);
  }
}

bootstrap();
