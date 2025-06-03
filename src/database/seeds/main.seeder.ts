import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserSeeder } from './user.seeder';

/**
 * Main seeder class that orchestrates the seeding process
 */
@Injectable()
export class MainSeeder {
  private readonly logger = new Logger(MainSeeder.name);
  private readonly environment: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly userSeeder: UserSeeder,
  ) {
    this.environment = this.configService.get('NODE_ENV', 'development');
  }

  /**
   * Seed all data based on the current environment
   */
  async seed(): Promise<void> {
    this.logger.log(`Starting seeding process in ${this.environment} environment`);

    try {
      // Always seed users
      await this.userSeeder.seed();
      
      // Add environment-specific seeding logic
      if (this.environment === 'development') {
        await this.seedDevelopmentData();
      } else if (this.environment === 'test') {
        await this.seedTestData();
      }

      this.logger.log('Seeding completed successfully');
    } catch (error) {
      this.logger.error(`Seeding failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear all seeded data
   */
  async clear(): Promise<void> {
    this.logger.log(`Clearing all seeded data in ${this.environment} environment`);

    try {
      // Clear all seeded data
      await this.userSeeder.clear();

      this.logger.log('Data clearing completed successfully');
    } catch (error) {
      this.logger.error(`Data clearing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Seed development-specific data
   */
  private async seedDevelopmentData(): Promise<void> {
    this.logger.log('Seeding development-specific data');
    // Add more development-specific seeding logic here
  }

  /**
   * Seed test-specific data
   */
  private async seedTestData(): Promise<void> {
    this.logger.log('Seeding test-specific data');
    // Add more test-specific seeding logic here
  }
}
