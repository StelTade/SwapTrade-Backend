import { Module } from '@nestjs/common';
import { CommonModule as OriginalCommonModule } from '../../common/common.module';
import { ErrorHandlingModule } from '../../common/error-handling.module';

/**
 * Infrastructure Common Facade Module
 *
 * Wraps the original CommonModule and ErrorHandlingModule from src/common/.
 * Provides: CommonService, AuditLogService, ErrorHandling services
 *           (CircuitBreaker, Retry, CorrelationId, Bulkhead, Saga, etc.)
 */
@Module({
  imports: [OriginalCommonModule, ErrorHandlingModule],
  exports: [OriginalCommonModule, ErrorHandlingModule],
})
export class InfrastructureCommonModule {}
