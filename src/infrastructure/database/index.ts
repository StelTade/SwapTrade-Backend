/**
 * Infrastructure Database Module
 * TypeORM setup, entity management, database services
 *
 * Facade over src/database/ — original implementation location
 */

export { InfrastructureDatabaseModule } from './database.module';
export { DatabaseModule } from '../../database/database.module';
export { DatabaseService } from '../../database/database.service';
export { DatabaseController } from '../../database/database.controller';
