import { Module } from '@nestjs/common';
import { ComplianceModule as OriginalComplianceModule } from '../../compliance/compliance.module';

/**
 * Identity Compliance Facade Module
 *
 * Wraps the original ComplianceModule from src/compliance/.
 * Provides: ComplianceMonitoringService, RegulatoryReportingService, ComplianceController
 */
@Module({
  imports: [OriginalComplianceModule],
  exports: [OriginalComplianceModule],
})
export class IdentityComplianceModule {}
