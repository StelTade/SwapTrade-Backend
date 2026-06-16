import { Module } from '@nestjs/common';
import { ConfigModule as OriginalConfigModule } from '../../config/config.module';

/**
 * Infrastructure Config Facade Module
 *
 * Wraps the original ConfigModule from src/config/.
 * Provides: ConfigService, ConfigDocumentationGenerator, ConfigAuditService
 */
@Module({
  imports: [OriginalConfigModule],
  exports: [OriginalConfigModule],
})
export class InfrastructureConfigModule {}
