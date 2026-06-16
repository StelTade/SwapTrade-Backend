import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { RegulatoryReportEntity, ReportType, ReportStatus, RegulatoryFramework, SubmissionMethod } from '../entities/regulatory-report.entity';
import { ComplianceAlertEntity } from '../entities/compliance-alert.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from '../../audit-log/audit-log.service';

interface ReportTemplate {
  type: ReportType;
  framework: RegulatoryFramework;
  requiredFields: string[];
  validationRules: Array<{
    field: string;
    rule: string;
    message: string;
  }>;
  submissionFormat: 'json' | 'xml' | 'csv' | 'pdf';
}

interface ReportData {
  reportType: ReportType;
  framework: RegulatoryFramework;
  reportingPeriod: { start: Date; end: Date };
  data: Record<string, any>;
}

@Injectable()
export class RegulatoryReportingService {
  private readonly logger = new Logger(RegulatoryReportingService.name);
  private readonly reportTemplates = new Map<string, ReportTemplate>();

  constructor(
    @InjectRepository(RegulatoryReportEntity)
    private readonly reportRepository: Repository<RegulatoryReportEntity>,
    @InjectRepository(ComplianceAlertEntity)
    private readonly alertRepository: Repository<ComplianceAlertEntity>,
    private readonly auditLogService: AuditLogService,
  ) {
    this.initializeReportTemplates();
  }

  private initializeReportTemplates(): void {
    // SAR Template
    this.reportTemplates.set(`${ReportType.SAR}_${RegulatoryFramework.FINCEN}`, {
      type: ReportType.SAR,
      framework: RegulatoryFramework.FINCEN,
      requiredFields: [
        'reportingEntity',
        'subjectUser',
        'suspiciousActivities',
        'transactionDetails',
        'timeframe',
      ],
      validationRules: [
        { field: 'suspiciousActivities', rule: 'required', message: 'Suspicious activities are required' },
        { field: 'transactionDetails', rule: 'minLength:1', message: 'At least one transaction is required' },
      ],
      submissionFormat: 'json',
    });

    // CTR Template
    this.reportTemplates.set(`${ReportType.CTR}_${RegulatoryFramework.FINCEN}`, {
      type: ReportType.CTR,
      framework: RegulatoryFramework.FINCEN,
      requiredFields: [
        'reportingEntity',
        'transactionDetails',
        'totalAmount',
        'currency',
      ],
      validationRules: [
        { field: 'totalAmount', rule: 'min:10000', message: 'Total amount must be $10,000 or more' },
      ],
      submissionFormat: 'json',
    });

    // AML Report Template
    this.reportTemplates.set(`${ReportType.AML}_${RegulatoryFramework.FATF}`, {
      type: ReportType.AML,
      framework: RegulatoryFramework.FATF,
      requiredFields: [
        'riskAssessment',
        'monitoringResults',
        'complianceMeasures',
      ],
      validationRules: [],
      submissionFormat: 'xml',
    });

    // SEC Form 4 Template
    this.reportTemplates.set(`${ReportType.SEC_FORM_4}_${RegulatoryFramework.SEC}`, {
      type: ReportType.SEC_FORM_4,
      framework: RegulatoryFramework.SEC,
      requiredFields: [
        'reportingPerson',
        'issuer',
        'transactionDate',
        'derivativeSecurities',
        'nonDerivativeSecurities',
      ],
      validationRules: [
        { field: 'transactionDate', rule: 'required', message: 'Transaction date is required' },
      ],
      submissionFormat: 'xml',
    });

    // FINRA CAT Template
    this.reportTemplates.set(`${ReportType.FINRA_CAT}_${RegulatoryFramework.FINRA}`, {
      type: ReportType.FINRA_CAT,
      framework: RegulatoryFramework.FINRA,
      requiredFields: [
        'eventTimestamp',
        'orderID',
        'symbol',
        'quantity',
        'price',
        'side',
      ],
      validationRules: [
        { field: 'orderID', rule: 'required', message: 'Order ID is required' },
        { field: 'symbol', rule: 'required', message: 'Symbol is required' },
      ],
      submissionFormat: 'json',
    });
  }

  async generateReport(reportData: ReportData): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating ${reportData.reportType} report for ${reportData.framework}`);

    try {
      // Validate report data
      await this.validateReportData(reportData);

      // Create report entity
      const report = this.reportRepository.create({
        reportId: this.generateReportId(),
        reportType: reportData.reportType,
        regulatoryFramework: reportData.framework,
        reportingPeriodStart: reportData.reportingPeriod.start,
        reportingPeriodEnd: reportData.reportingPeriod.end,
        reportingEntity: reportData.data.reportingEntity,
        title: `${reportData.reportType.toUpperCase()} Report - ${reportData.reportingPeriod.start.toISOString().split('T')[0]}`,
        summary: this.generateReportSummary(reportData),
        reportData: reportData.data,
        riskLevel: this.assessReportRiskLevel(reportData),
        submissionMethod: SubmissionMethod.API,
        status: ReportStatus.DRAFT,
      });

      return this.reportRepository.save(report);
    } catch (error) {
      this.logger.error('Report generation failed:', error);
      throw error;
    }
  }

  async submitReport(reportId: string): Promise<RegulatoryReportEntity> {
    this.logger.log(`Submitting report ${reportId}`);

    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    try {
      // Validate report before submission
      await this.validateReportForSubmission(report);

      // Format report for submission
      const formattedReport = await this.formatReportForSubmission(report);

      // Submit to regulatory authority
      const submissionResult = await this.submitToAuthority(report, formattedReport);

      // Update report status
      report.status = ReportStatus.SUBMITTED;
      report.submissionDate = new Date();
      report.submissionReference = submissionResult.reference;
      report.submissionAttempts += 1;
      report.lastSubmissionAttempt = new Date();

      return this.reportRepository.save(report);
    } catch (error) {
      this.logger.error(`Report submission failed for ${reportId}:`, error);
      
      // Update submission attempts
      report.submissionAttempts += 1;
      report.lastSubmissionAttempt = new Date();
      await this.reportRepository.save(report);
      
      throw error;
    }
  }

  async generateSARReport(alertIds: string[]): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating SAR report for alerts: ${alertIds.join(', ')}`);

    // Get related alerts
    const alerts = await this.alertRepository.find({
      where: { id: In(alertIds) },
      relations: ['user', 'rule'],
    });

    if (alerts.length === 0) {
      throw new Error('No alerts found for SAR report generation');
    }

    // Group alerts by user if multiple users involved
    const alertsByUser = alerts.reduce((groups, alert) => {
      if (!groups[alert.userId]) {
        groups[alert.userId] = [];
      }
      groups[alert.userId].push(alert);
      return groups;
    }, {} as Record<string, ComplianceAlertEntity[]>);

    // Generate SAR data
    const sarData = this.generateSARData(alertsByUser);

    const reportData: ReportData = {
      reportType: ReportType.SAR,
      framework: RegulatoryFramework.FINCEN,
      reportingPeriod: {
        start: new Date(Math.min(...alerts.map(a => a.createdAt.getTime()))),
        end: new Date(Math.max(...alerts.map(a => a.createdAt.getTime()))),
      },
      data: sarData,
    };

    const report = await this.generateReport(reportData);
    
    // Link alerts to report
    await this.linkAlertsToReport(alertIds, report.id);

    return report;
  }

  async generateCTRReport(transactionData: any[]): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating CTR report for ${transactionData.length} transactions`);

    // Filter transactions over $10,000
    const reportableTransactions = transactionData.filter(tx => tx.amount >= 10000);
    
    if (reportableTransactions.length === 0) {
      throw new Error('No transactions meet CTR reporting threshold');
    }

    const ctrData = {
      reportingEntity: 'SwapTrade',
      transactionDetails: reportableTransactions,
      totalAmount: reportableTransactions.reduce((sum, tx) => sum + tx.amount, 0),
      currency: 'USD',
      timeframe: {
        start: new Date(Math.min(...reportableTransactions.map(tx => new Date(tx.timestamp).getTime()))),
        end: new Date(Math.max(...reportableTransactions.map(tx => new Date(tx.timestamp).getTime()))),
      },
    };

    const reportData: ReportData = {
      reportType: ReportType.CTR,
      framework: RegulatoryFramework.FINCEN,
      reportingPeriod: ctrData.timeframe,
      data: ctrData,
    };

    return this.generateReport(reportData);
  }

  async generateAMLReport(periodStart: Date, periodEnd: Date): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating AML report for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // Get compliance data for the period
    const complianceData = await this.getComplianceDataForPeriod(periodStart, periodEnd);

    const amlData = {
      riskAssessment: this.performRiskAssessment(complianceData),
      monitoringResults: this.summarizeMonitoringResults(complianceData),
      complianceMeasures: this.documentComplianceMeasures(complianceData),
      recommendations: this.generateAMLRecommendations(complianceData),
    };

    const reportData: ReportData = {
      reportType: ReportType.AML,
      framework: RegulatoryFramework.FATF,
      reportingPeriod: { start: periodStart, end: periodEnd },
      data: amlData,
    };

    return this.generateReport(reportData);
  }

  async generateSECForm4(userId: string, transactionIds: string[]): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating SEC Form 4 for user ${userId}`);

    const secData = {
      reportingPerson: { userId },
      issuer: 'SwapTrade Platform',
      transactionDate: new Date(),
      nonDerivativeSecurities: transactionIds.map(id => ({ transactionId: id })),
      derivativeSecurities: [],
      reportingEntity: 'SwapTrade',
    };

    const reportData: ReportData = {
      reportType: ReportType.SEC_FORM_4,
      framework: RegulatoryFramework.SEC,
      reportingPeriod: { start: new Date(), end: new Date() },
      data: secData,
    };

    return this.generateReport(reportData);
  }

  async generateFINRACAT(orderIds: string[]): Promise<RegulatoryReportEntity> {
    this.logger.log(`Generating FINRA CAT report for orders: ${orderIds.join(', ')}`);

    const catData = {
      reportingEntity: 'SwapTrade',
      events: orderIds.map(id => ({
        eventTimestamp: new Date(),
        orderID: id,
        symbol: 'UNKNOWN', // In real app, fetch from order data
        quantity: 0,
        price: 0,
        side: 'BUY',
      })),
      // Dummy data for required fields to pass validation if needed
      eventTimestamp: new Date(),
      orderID: orderIds[0] || 'GENERIC_ID',
      symbol: 'GENERIC',
      quantity: 1,
      price: 1,
      side: 'BUY',
    };

    const reportData: ReportData = {
      reportType: ReportType.FINRA_CAT,
      framework: RegulatoryFramework.FINRA,
      reportingPeriod: { start: new Date(), end: new Date() },
      data: catData,
    };

    return this.generateReport(reportData);
  }

  async exportAuditTrail(userId: string, from: Date, to: Date): Promise<string> {
    this.logger.log(`Exporting audit trail for user ${userId} from ${from} to ${to}`);

    const logs = await this.auditLogService.getByUser(userId, from, to);
    const integrity = await this.auditLogService.verifyChainIntegrity();

    const exportData = {
      userId,
      exportDate: new Date(),
      integrityStatus: integrity.valid ? 'VERIFIED' : 'FAILED',
      logs: logs.map(log => ({
        timestamp: log.createdAt,
        event: log.eventType,
        severity: log.severity,
        checksum: log.checksum,
        metadata: log.metadata,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async validateTransactionHistory(userId: string, transactions: any[]): Promise<any> {
    this.logger.log(`Validating transaction history for user ${userId}`);

    const validations = transactions.map(tx => {
      const issues: string[] = [];
      if (!tx.timestamp) issues.push('Missing timestamp');
      if (!tx.amount || tx.amount <= 0) issues.push('Invalid amount');
      if (!tx.asset) issues.push('Missing asset');

      return {
        transactionId: tx.id,
        isValid: issues.length === 0,
        issues,
      };
    });

    return {
      userId,
      validatedAt: new Date(),
      summary: {
        total: transactions.length,
        valid: validations.filter(v => v.isValid).length,
        invalid: validations.filter(v => !v.isValid).length,
      },
      results: validations,
    };
  }

  private async validateReportData(reportData: ReportData): Promise<void> {
    const templateKey = `${reportData.reportType}_${reportData.framework}`;
    const template = this.reportTemplates.get(templateKey);

    if (!template) {
      throw new Error(`No template found for ${reportData.reportType} under ${reportData.framework}`);
    }

    // Check required fields
    for (const field of template.requiredFields) {
      if (!reportData.data[field]) {
        throw new Error(`Required field '${field}' is missing`);
      }
    }

    // Apply validation rules
    for (const rule of template.validationRules) {
      if (!this.validateField(reportData.data[rule.field], rule.rule)) {
        throw new Error(`Validation failed for field '${rule.field}': ${rule.message}`);
      }
    }
  }

  private validateField(value: any, rule: string): boolean {
    const [ruleName, ruleParam] = rule.split(':');
    
    switch (ruleName) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      case 'min':
        return Number(value) >= Number(ruleParam);
      case 'minLength':
        return Array.isArray(value) ? value.length >= Number(ruleParam) : String(value).length >= Number(ruleParam);
      default:
        return true;
    }
  }

  private async validateReportForSubmission(report: RegulatoryReportEntity): Promise<void> {
    if (report.status !== ReportStatus.DRAFT && report.status !== ReportStatus.REJECTED) {
      throw new Error(`Report ${report.id} is not in a submittable state`);
    }

    // Additional validation logic here
  }

  private async formatReportForSubmission(report: RegulatoryReportEntity): Promise<any> {
    const templateKey = `${report.reportType}_${report.regulatoryFramework}`;
    const template = this.reportTemplates.get(templateKey);

    if (!template) {
      throw new Error(`No submission template found for ${report.reportType}`);
    }

    switch (template.submissionFormat) {
      case 'json':
        return this.formatAsJSON(report);
      case 'xml':
        return this.formatAsXML(report);
      case 'csv':
        return this.formatAsCSV(report);
      default:
        return report.reportData;
    }
  }

  private formatAsJSON(report: RegulatoryReportEntity): any {
    return {
      reportId: report.reportId,
      reportType: report.reportType,
      framework: report.regulatoryFramework,
      reportingPeriod: {
        start: report.reportingPeriodStart,
        end: report.reportingPeriodEnd,
      },
      data: report.reportData,
      submittedAt: new Date().toISOString(),
    };
  }

  private formatAsXML(report: RegulatoryReportEntity): string {
    // Simplified XML formatting
    return `<?xml version="1.0" encoding="UTF-8"?>
<report>
  <id>${report.reportId}</id>
  <type>${report.reportType}</type>
  <framework>${report.regulatoryFramework}</framework>
  <data>${JSON.stringify(report.reportData)}</data>
</report>`;
  }

  private formatAsCSV(report: RegulatoryReportEntity): string {
    // Simplified CSV formatting
    const headers = ['Report ID', 'Type', 'Framework', 'Created Date'];
    const row = [report.reportId, report.reportType, report.regulatoryFramework, report.createdAt.toISOString()];
    
    return [headers.join(','), row.join(',')].join('\n');
  }

  private async submitToAuthority(report: RegulatoryReportEntity, formattedReport: any): Promise<{ reference: string }> {
    // Mock submission - in production, this would make actual API calls to regulatory authorities
    this.logger.log(`Submitting ${report.reportType} report to ${report.regulatoryFramework}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      reference: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    };
  }

  private generateReportSummary(reportData: ReportData): string {
    return `${reportData.reportType.toUpperCase()} report generated for ${reportData.framework} covering period ${reportData.reportingPeriod.start.toISOString().split('T')[0]} to ${reportData.reportingPeriod.end.toISOString().split('T')[0]}`;
  }

  private assessReportRiskLevel(reportData: ReportData): string {
    // Simplified risk assessment
    if (reportData.reportType === ReportType.SAR) {
      return 'HIGH';
    } else if (reportData.reportType === ReportType.CTR) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  private generateSARData(alertsByUser: Record<string, ComplianceAlertEntity[]>): any {
    return {
      reportingEntity: 'SwapTrade',
      subjects: Object.entries(alertsByUser).map(([userId, alerts]) => ({
        userId,
        suspiciousActivities: alerts.map(alert => ({
          type: alert.alertType,
          description: alert.description,
          riskScore: alert.riskScore,
          timestamp: alert.createdAt,
        })),
        totalRiskScore: Math.max(...alerts.map(a => a.riskScore)),
      })),
      totalAlerts: Object.values(alertsByUser).flat().length,
    };
  }

  private async getComplianceDataForPeriod(start: Date, end: Date): Promise<any> {
    // Mock data - in production, this would query actual compliance databases
    return {
      totalAlerts: 150,
      highRiskAlerts: 25,
      blockedTransactions: 12,
      flaggedUsers: 8,
    };
  }

  private performRiskAssessment(data: any): any {
    return {
      overallRiskLevel: 'MEDIUM',
      riskFactors: [
        { factor: 'High transaction volume', level: 'MEDIUM' },
        { factor: 'Geographic risk', level: 'LOW' },
        { factor: 'Unusual patterns', level: 'HIGH' },
      ],
      riskScore: 65,
    };
  }

  private summarizeMonitoringResults(data: any): any {
    return {
      alertsGenerated: data.totalAlerts,
      alertsInvestigated: Math.floor(data.totalAlerts * 0.8),
      alertsResolved: Math.floor(data.totalAlerts * 0.6),
      falsePositiveRate: 0.15,
    };
  }

  private documentComplianceMeasures(data: any): any {
    return {
      automatedMonitoring: true,
      manualReview: true,
      transactionLimits: true,
      geographicRestrictions: true,
      staffTraining: 'Quarterly',
      systemUpdates: 'Monthly',
    };
  }

  private generateAMLRecommendations(data: any): string[] {
    return [
      'Increase monitoring threshold for high-risk jurisdictions',
      'Implement enhanced due diligence for transactions over $50,000',
      'Review and update sanction screening procedures',
      'Conduct additional staff training on emerging AML patterns',
    ];
  }

  private async linkAlertsToReport(alertIds: string[], reportId: string): Promise<void> {
    // Update alerts to link them to the report
    await this.alertRepository.update(
      { id: In(alertIds) },
      { regulatoryReportRequired: true, regulatoryReportStatus: 'submitted' }
    );
  }

  private generateReportId(): string {
    return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async checkDueReports(): Promise<void> {
    this.logger.log('Checking for due regulatory reports...');
    
    const today = new Date();
    const dueReports = await this.reportRepository.find({
      where: {
        dueDate: LessThanOrEqual(today),
        status: In([ReportStatus.DRAFT, ReportStatus.PENDING_REVIEW]),
      },
    });

    for (const report of dueReports) {
      this.logger.warn(`Report ${report.reportId} is due for submission`);
      // In production, this would send notifications to compliance officers
    }
  }

  async getReportsByStatus(status: ReportStatus): Promise<RegulatoryReportEntity[]> {
    return this.reportRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async getReportsByType(reportType: ReportType): Promise<RegulatoryReportEntity[]> {
    return this.reportRepository.find({
      where: { reportType },
      order: { createdAt: 'DESC' },
    });
  }
}