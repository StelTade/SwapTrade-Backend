import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceRuleEntity } from './entities/compliance-rule.entity';
import { ComplianceAlertEntity } from './entities/compliance-alert.entity';
import { AuditTrailEntity } from './entities/audit-trail.entity';
import { RegulatoryReportEntity } from './entities/regulatory-report.entity';
import { ComplianceController } from './controller/compliance.controller';
import { ComplianceMonitoringService } from './services/compliance-monitoring.service';
import { RegulatoryReportingService } from './services/regulatory-reporting.service';
import { DidModule } from '../did/did.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ComplianceRuleEntity,
      ComplianceAlertEntity,
      AuditTrailEntity,
      RegulatoryReportEntity,
    ]),
    DidModule,
    AuditLogModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceMonitoringService, RegulatoryReportingService],
  exports: [ComplianceMonitoringService, RegulatoryReportingService],
})
export class ComplianceModule {}
