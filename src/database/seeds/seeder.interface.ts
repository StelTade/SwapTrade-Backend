/**
 * Interface for all data seeders in the application
 */
export interface Seeder {
  /**
   * Seed data into the database
   */
  seed(): Promise<void>;

  /**
   * Clear seeded data from the database
   */
  clear(): Promise<void>;
}
