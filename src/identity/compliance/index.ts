/**
 * Identity Compliance Module
 * Compliance rules, regulatory checks, audit compliance
 *
 * Facade over src/compliance/ — original implementation location
 */

export { IdentityComplianceModule } from './compliance.module';
export { ComplianceModule } from '../../compliance/compliance.module';
export { ComplianceMonitoringService } from '../../compliance/services/compliance-monitoring.service';
export { RegulatoryReportingService } from '../../compliance/services/regulatory-reporting.service';
