import { Module } from '@nestjs/common';
import { LoggingModule as OriginalLoggingModule } from '../../common/logging/logging_module';

/**
 * Infrastructure Logging Facade Module
 *
 * Wraps the original LoggingModule from src/common/logging/.
 * Provides: LoggerService, AuditService, MetricsService
 */
@Module({
  imports: [OriginalLoggingModule],
  exports: [OriginalLoggingModule],
})
export class InfrastructureLoggingModule {}
