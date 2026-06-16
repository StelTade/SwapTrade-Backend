import { Module } from '@nestjs/common';
import { AuditLogModule as OriginalAuditLogModule } from '../../audit-log/audit-log.module';

/**
 * Infrastructure Audit Log Facade Module
 *
 * Wraps the original AuditLogModule from src/audit-log/.
 * Provides: AuditLogService
 */
@Module({
  imports: [OriginalAuditLogModule],
  exports: [OriginalAuditLogModule],
})
export class InfrastructureAuditLogModule {}
