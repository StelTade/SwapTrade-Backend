/**
 * Infrastructure Configuration Module
 * Environment variables, configuration schemas, validators
 *
 * Facade over src/config/ — original implementation location
 */

// Re-export the facade module
export { InfrastructureConfigModule } from './config.module';

// Re-export original module and services for direct consumption
export { ConfigModule } from '../../config/config.module';
export { ConfigService } from '../../config/config.service';
export { ConfigDocumentationGenerator } from '../../config/config-documentation.generator';
export { ConfigAuditService } from '../../config/config-audit.service';
export { configSchema } from '../../config/config.schema';
