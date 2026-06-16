import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ComplianceMonitoringService } from '../services/compliance-monitoring.service';
import { RegulatoryReportingService } from '../services/regulatory-reporting.service';
import { ComplianceAlertEntity, AlertStatus, AlertPriority } from '../entities/compliance-alert.entity';
import { RegulatoryReportEntity, ReportType, ReportStatus, RegulatoryFramework } from '../entities/regulatory-report.entity';

interface TransactionMonitoringRequest {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  type: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  counterparties: string[];
  geographicLocation?: string;
  assetSymbol?: string;
}

interface SARReportRequest {
  alertIds: string[];
}

interface CTRReportRequest {
  transactions: any[];
}

interface AMLReportRequest {
  periodStart: string;
  periodEnd: string;
}

interface AlertResolutionRequest {
  resolutionDetails: string;
}

@ApiTags('Institutional Compliance and Audit')
@Controller('compliance')
@ApiBearerAuth()
export class ComplianceController {
  private readonly logger = new Logger(ComplianceController.name);

  constructor(
    private readonly complianceMonitoringService: ComplianceMonitoringService,
    private readonly regulatoryReportingService: RegulatoryReportingService,
  ) {}

  @Post('monitor/transaction')
  @ApiOperation({ summary: 'Monitor transaction for compliance violations' })
  @ApiResponse({ status: 200, description: 'Transaction monitoring completed', type: [ComplianceAlertEntity] })
  @ApiResponse({ status: 400, description: 'Invalid transaction data' })
  async monitorTransaction(
    @Body() transactionData: TransactionMonitoringRequest,
  ): Promise<ComplianceAlertEntity[]> {
    try {
      return await this.complianceMonitoringService.monitorTransaction(transactionData);
    } catch (error) {
      this.logger.error('Transaction monitoring failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get active compliance alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved', type: [ComplianceAlertEntity] })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getActiveAlerts(
    @Query('userId') userId?: string,
    @Query('status') status?: AlertStatus,
  ): Promise<ComplianceAlertEntity[]> {
    try {
      if (status === AlertStatus.OPEN || !status) {
        return await this.complianceMonitoringService.getActiveAlerts(userId);
      }
      // Would need to implement getAlertsByStatus in the service
      throw new BadRequestException('Filtering by status other than OPEN not implemented');
    } catch (error) {
      this.logger.error('Failed to get alerts:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Put('alerts/:alertId/resolve')
  @ApiOperation({ summary: 'Resolve a compliance alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolveAlert(
    @Param('alertId') alertId: string,
    @Body() resolutionRequest: AlertResolutionRequest,
    @Request() req: any,
  ): Promise<{ message: string }> {
    try {
      const resolvedBy = req.user.id;
      await this.complianceMonitoringService.resolveAlert(
        alertId,
        resolutionRequest.resolutionDetails,
        resolvedBy,
      );
      
      return { message: 'Alert resolved successfully' };
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}:`, error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/sar')
  @ApiOperation({ summary: 'Generate Suspicious Activity Report (SAR)' })
  @ApiResponse({ status: 201, description: 'SAR report generated', type: RegulatoryReportEntity })
  @ApiResponse({ status: 400, description: 'Invalid alert data' })
  async generateSARReport(
    @Body() sarRequest: SARReportRequest,
  ): Promise<RegulatoryReportEntity> {
    try {
      return await this.regulatoryReportingService.generateSARReport(sarRequest.alertIds);
    } catch (error) {
      this.logger.error('SAR report generation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/ctr')
  @ApiOperation({ summary: 'Generate Currency Transaction Report (CTR)' })
  @ApiResponse({ status: 201, description: 'CTR report generated', type: RegulatoryReportEntity })
  @ApiResponse({ status: 400, description: 'Invalid transaction data' })
  async generateCTRReport(
    @Body() ctrRequest: CTRReportRequest,
  ): Promise<RegulatoryReportEntity> {
    try {
      return await this.regulatoryReportingService.generateCTRReport(ctrRequest.transactions);
    } catch (error) {
      this.logger.error('CTR report generation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/aml')
  @ApiOperation({ summary: 'Generate Anti-Money Laundering (AML) report' })
  @ApiResponse({ status: 201, description: 'AML report generated', type: RegulatoryReportEntity })
  @ApiResponse({ status: 400, description: 'Invalid period data' })
  async generateAMLReport(
    @Body() amlRequest: AMLReportRequest,
  ): Promise<RegulatoryReportEntity> {
    try {
      const periodStart = new Date(amlRequest.periodStart);
      const periodEnd = new Date(amlRequest.periodEnd);
      
      return await this.regulatoryReportingService.generateAMLReport(periodStart, periodEnd);
    } catch (error) {
      this.logger.error('AML report generation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/sec-form-4')
  @ApiOperation({ summary: 'Generate SEC Form 4 report' })
  @ApiResponse({ status: 201, description: 'SEC Form 4 report generated', type: RegulatoryReportEntity })
  async generateSECForm4(
    @Body() body: { userId: string; transactionIds: string[] },
  ): Promise<RegulatoryReportEntity> {
    try {
      return await this.regulatoryReportingService.generateSECForm4(body.userId, body.transactionIds);
    } catch (error) {
      this.logger.error('SEC Form 4 report generation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/finra-cat')
  @ApiOperation({ summary: 'Generate FINRA CAT report' })
  @ApiResponse({ status: 201, description: 'FINRA CAT report generated', type: RegulatoryReportEntity })
  async generateFINRACAT(
    @Body() body: { orderIds: string[] },
  ): Promise<RegulatoryReportEntity> {
    try {
      return await this.regulatoryReportingService.generateFINRACAT(body.orderIds);
    } catch (error) {
      this.logger.error('FINRA CAT report generation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('audit-trail/export')
  @ApiOperation({ summary: 'Export audit trail' })
  @ApiResponse({ status: 200, description: 'Audit trail exported' })
  async exportAuditTrail(
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: string }> {
    try {
      const data = await this.regulatoryReportingService.exportAuditTrail(
        userId,
        new Date(startDate),
        new Date(endDate),
      );
      return { data };
    } catch (error) {
      this.logger.error('Audit trail export failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('validate-history')
  @ApiOperation({ summary: 'Validate transaction history for compliance' })
  @ApiResponse({ status: 200, description: 'Transaction history validated' })
  async validateTransactionHistory(
    @Body() body: { userId: string; transactions: any[] },
  ): Promise<any> {
    try {
      return await this.regulatoryReportingService.validateTransactionHistory(body.userId, body.transactions);
    } catch (error) {
      this.logger.error('Transaction history validation failed:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Post('reports/:reportId/submit')
  @ApiOperation({ summary: 'Submit regulatory report' })
  @ApiResponse({ status: 200, description: 'Report submitted successfully', type: RegulatoryReportEntity })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async submitReport(@Param('reportId') reportId: string): Promise<RegulatoryReportEntity> {
    try {
      return await this.regulatoryReportingService.submitReport(reportId);
    } catch (error) {
      this.logger.error(`Report submission failed for ${reportId}:`, error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get regulatory reports' })
  @ApiResponse({ status: 200, description: 'Reports retrieved', type: [RegulatoryReportEntity] })
  async getReports(
    @Query('status') status?: ReportStatus,
    @Query('type') type?: ReportType,
    @Query('framework') framework?: RegulatoryFramework,
  ): Promise<RegulatoryReportEntity[]> {
    try {
      if (status) {
        return await this.regulatoryReportingService.getReportsByStatus(status);
      }
      
      if (type) {
        return await this.regulatoryReportingService.getReportsByType(type);
      }

      // Would need to implement getReportsWithFilters in the service
      throw new BadRequestException('Filtering by framework not implemented');
    } catch (error) {
      this.logger.error('Failed to get reports:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: 'Get specific regulatory report' })
  @ApiResponse({ status: 200, description: 'Report retrieved', type: RegulatoryReportEntity })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Param('reportId') reportId: string): Promise<RegulatoryReportEntity> {
    try {
      // Would need to implement getReportById in the service
      throw new BadRequestException('Get report by ID not implemented');
    } catch (error) {
      this.logger.error(`Failed to get report ${reportId}:`, error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get compliance dashboard summary' })
  @ApiResponse({ status: 200, description: 'Dashboard summary retrieved' })
  async getComplianceSummary(): Promise<{
    activeAlerts: number;
    pendingReports: number;
    highRiskAlerts: number;
    recentSubmissions: number;
  }> {
    try {
      const activeAlerts = await this.complianceMonitoringService.getActiveAlerts();
      const pendingReports = await this.regulatoryReportingService.getReportsByStatus(ReportStatus.DRAFT);
      
      const highRiskAlerts = activeAlerts.filter(alert => 
        alert.priority === AlertPriority.HIGH || alert.priority === AlertPriority.CRITICAL
      ).length;

      const recentSubmissions = await this.regulatoryReportingService.getReportsByStatus(ReportStatus.SUBMITTED);

      return {
        activeAlerts: activeAlerts.length,
        pendingReports: pendingReports.length,
        highRiskAlerts,
        recentSubmissions: recentSubmissions.length,
      };
    } catch (error) {
      this.logger.error('Failed to get compliance summary:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('risk-assessment/:userId')
  @ApiOperation({ summary: 'Get user risk assessment' })
  @ApiResponse({ status: 200, description: 'Risk assessment retrieved' })
  async getUserRiskAssessment(@Param('userId') userId: string): Promise<{
    userId: string;
    riskScore: number;
    riskLevel: string;
    riskFactors: string[];
    recommendations: string[];
  }> {
    try {
      const alerts = await this.complianceMonitoringService.getActiveAlerts(userId);
      
      // Simplified risk assessment
      const riskScore = Math.min(100, alerts.length * 10 + Math.random() * 20);
      let riskLevel = 'LOW';
      
      if (riskScore >= 80) riskLevel = 'CRITICAL';
      else if (riskScore >= 60) riskLevel = 'HIGH';
      else if (riskScore >= 40) riskLevel = 'MEDIUM';

      const riskFactors = alerts.map(alert => alert.alertType);
      const recommendations = this.generateRiskRecommendations(riskLevel, alerts);

      return {
        userId,
        riskScore,
        riskLevel,
        riskFactors,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Failed to get risk assessment for user ${userId}:`, error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  @Get('audit-trail')
  @ApiOperation({ summary: 'Get audit trail (compliance view)' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved' })
  async getAuditTrail(
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ): Promise<{
    records: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Would need to implement getAuditTrail in the service
      return {
        records: [],
        total: 0,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to get audit trail:', error);
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  private generateRiskRecommendations(riskLevel: string, alerts: ComplianceAlertEntity[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push('Immediate manual review required');
      recommendations.push('Consider temporary account restrictions');
    }

    if (riskLevel === 'MEDIUM') {
      recommendations.push('Enhanced monitoring recommended');
      recommendations.push('Additional documentation required');
    }

    if (alerts.some(alert => alert.alertType === 'geographic_restriction')) {
      recommendations.push('Verify user location and identity');
    }

    if (alerts.some(alert => alert.alertType === 'transaction_limit')) {
      recommendations.push('Review transaction patterns and limits');
    }

    if (alerts.some(alert => alert.alertType === 'aml_screening')) {
      recommendations.push('Conduct enhanced due diligence');
    }

    return recommendations;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown error occurred';
  }
}