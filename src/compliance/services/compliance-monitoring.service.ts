import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComplianceRuleEntity, RuleType, ActionType, RuleSeverity, RuleStatus } from '../entities/compliance-rule.entity';
import { ComplianceAlertEntity, AlertStatus, AlertPriority } from '../entities/compliance-alert.entity';
import { AuditTrailEntity, AuditAction, ResourceType, AuditStatus } from '../entities/audit-trail.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VcIssuerService } from '../../did/services/vc-issuer.service';

interface TransactionData {
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

interface RuleEvaluation {
  rule: ComplianceRuleEntity;
  triggered: boolean;
  riskScore: number;
  details: Record<string, any>;
}

@Injectable()
export class ComplianceMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(ComplianceMonitoringService.name);
  private readonly watchlist = new Set<string>();
  private readonly sanctionedCountries = new Set<string>();

  constructor(
    @InjectRepository(ComplianceRuleEntity)
    private readonly complianceRuleRepository: Repository<ComplianceRuleEntity>,
    @InjectRepository(ComplianceAlertEntity)
    private readonly complianceAlertRepository: Repository<ComplianceAlertEntity>,
    @InjectRepository(AuditTrailEntity)
    private readonly auditTrailRepository: Repository<AuditTrailEntity>,
    private readonly vcIssuerService: VcIssuerService,
  ) {}

  async onModuleInit() {
    await this.loadComplianceData();
    this.logger.log('Compliance monitoring service initialized');
  }

  async monitorTransaction(transactionData: TransactionData): Promise<ComplianceAlertEntity[]> {
    this.logger.log(`Monitoring transaction ${transactionData.id} for user ${transactionData.userId}`);

    const alerts: ComplianceAlertEntity[] = [];
    
    try {
      // Get applicable compliance rules
      const rules = await this.getApplicableRules(transactionData);
      
      // Evaluate each rule
      const evaluations = await Promise.all(
        rules.map(rule => this.evaluateRule(rule, transactionData))
      );

      // Generate alerts for triggered rules
      for (const evaluation of evaluations) {
        if (evaluation.triggered) {
          const alert = await this.createAlert(evaluation, transactionData);
          alerts.push(alert);
          
          // Take immediate action based on rule
          await this.takeAction(evaluation.rule, alert, transactionData);
        }
      }

      // Log the monitoring activity
      await this.logAuditTrail(transactionData, evaluations);

      return alerts;
    } catch (error) {
      this.logger.error('Transaction monitoring failed:', error);
      throw error;
    }
  }

  private async getApplicableRules(transactionData: TransactionData): Promise<ComplianceRuleEntity[]> {
    return this.complianceRuleRepository.find({
      where: { status: RuleStatus.ACTIVE },
      order: { severity: 'DESC' },
    });
  }

  private async evaluateRule(
    rule: ComplianceRuleEntity,
    transactionData: TransactionData,
  ): Promise<RuleEvaluation> {
    const triggered = await this.checkRuleConditions(rule, transactionData);
    const riskScore = triggered ? this.calculateRiskScore(rule, transactionData) : 0;
    const details = this.buildRuleDetails(rule, transactionData);

    return {
      rule,
      triggered,
      riskScore,
      details,
    };
  }

  private async checkRuleConditions(
    rule: ComplianceRuleEntity,
    transactionData: TransactionData,
  ): Promise<boolean> {
    switch (rule.ruleType) {
      case RuleType.TRANSACTION_LIMIT:
        return this.checkTransactionLimit(rule, transactionData);
      case RuleType.GEOGRAPHIC_RESTRICTION:
        return this.checkGeographicRestriction(rule, transactionData);
      case RuleType.ASSET_RESTRICTION:
        return this.checkAssetRestriction(rule, transactionData);
      case RuleType.VOLUME_LIMIT:
        return this.checkVolumeLimit(rule, transactionData);
      case RuleType.FREQUENCY_LIMIT:
        return this.checkFrequencyLimit(rule, transactionData);
      case RuleType.AML_SCREENING:
        return this.checkAMLScreening(rule, transactionData);
      case RuleType.SANCTIONS_CHECK:
        return this.checkSanctions(rule, transactionData);
      default:
        return false;
    }
  }

  private checkTransactionLimit(rule: ComplianceRuleEntity, transactionData: TransactionData): boolean {
    const { minAmount, maxAmount, currency } = rule.conditions;
    
    if (currency && transactionData.currency !== currency) {
      return false;
    }

    if (minAmount && transactionData.amount < minAmount) {
      return true;
    }

    if (maxAmount && transactionData.amount > maxAmount) {
      return true;
    }

    return false;
  }

  private checkGeographicRestriction(rule: ComplianceRuleEntity, transactionData: TransactionData): boolean {
    const { restrictedCountries, allowedCountries } = rule.conditions;
    const location = transactionData.geographicLocation;

    if (!location) {
      return false;
    }

    if (restrictedCountries && restrictedCountries.includes(location)) {
      return true;
    }

    if (allowedCountries && !allowedCountries.includes(location)) {
      return true;
    }

    return false;
  }

  private checkAssetRestriction(rule: ComplianceRuleEntity, transactionData: TransactionData): boolean {
    const { restrictedAssets, allowedAssets } = rule.conditions;
    const asset = transactionData.assetSymbol;

    if (!asset) {
      return false;
    }

    if (restrictedAssets && restrictedAssets.includes(asset)) {
      return true;
    }

    if (allowedAssets && !allowedAssets.includes(asset)) {
      return true;
    }

    return false;
  }

  private async checkVolumeLimit(rule: ComplianceRuleEntity, transactionData: TransactionData): Promise<boolean> {
    const { period, maxVolume, currency } = rule.conditions;
    
    if (currency && transactionData.currency !== currency) {
      return false;
    }

    // Calculate user's transaction volume in the specified period
    const periodStart = new Date();
    switch (period) {
      case 'daily':
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case 'weekly':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'monthly':
        periodStart.setMonth(periodStart.getMonth() - 1);
        break;
      default:
        return false;
    }

    // This would typically query the transaction database
    // For demonstration, we'll use a mock calculation
    const currentVolume = await this.calculateUserVolume(transactionData.userId, periodStart, currency);

    return currentVolume + transactionData.amount > maxVolume;
  }

  private async checkFrequencyLimit(rule: ComplianceRuleEntity, transactionData: TransactionData): Promise<boolean> {
    const { period, maxTransactions } = rule.conditions;
    
    const periodStart = new Date();
    switch (period) {
      case 'hourly':
        periodStart.setHours(periodStart.getHours() - 1);
        break;
      case 'daily':
        periodStart.setDate(periodStart.getDate() - 1);
        break;
      case 'weekly':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      default:
        return false;
    }

    // This would typically query the transaction database
    const transactionCount = await this.calculateUserTransactionCount(transactionData.userId, periodStart);

    return transactionCount >= maxTransactions;
  }

  private checkAMLScreening(rule: ComplianceRuleEntity, transactionData: TransactionData): boolean {
    const { patterns } = rule.conditions;
    
    // Check for suspicious patterns
    for (const pattern of patterns) {
      if (this.matchesPattern(transactionData, pattern)) {
        return true;
      }
    }

    return false;
  }

  private checkSanctions(rule: ComplianceRuleEntity, transactionData: TransactionData): boolean {
    const { checkCounterparties, checkLocation } = rule.conditions;

    if (checkLocation && this.sanctionedCountries.has(transactionData.geographicLocation || '')) {
      return true;
    }

    if (checkCounterparties) {
      for (const counterparty of transactionData.counterparties) {
        if (this.watchlist.has(counterparty)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesPattern(transactionData: TransactionData, pattern: string): boolean {
    switch (pattern) {
      case 'round_amount':
        return transactionData.amount % 1000 === 0;
      case 'high_velocity':
        return transactionData.amount > 10000;
      case 'unusual_timing':
        const hour = transactionData.timestamp.getHours();
        return hour < 6 || hour > 22;
      case 'structuring':
        return transactionData.amount > 9000 && transactionData.amount < 10000;
      default:
        return false;
    }
  }

  private calculateRiskScore(rule: ComplianceRuleEntity, transactionData: TransactionData): number {
    let baseScore = 0;
    
    switch (rule.severity) {
      case RuleSeverity.LOW:
        baseScore = 25;
        break;
      case RuleSeverity.MEDIUM:
        baseScore = 50;
        break;
      case RuleSeverity.HIGH:
        baseScore = 75;
        break;
      case RuleSeverity.CRITICAL:
        baseScore = 100;
        break;
    }

    // Adjust based on transaction characteristics
    if (transactionData.amount > 50000) {
      baseScore += 10;
    }

    if (this.sanctionedCountries.has(transactionData.geographicLocation || '')) {
      baseScore += 20;
    }

    return Math.min(100, baseScore);
  }

  private buildRuleDetails(rule: ComplianceRuleEntity, transactionData: TransactionData): Record<string, any> {
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      conditions: rule.conditions,
      transactionData: {
        id: transactionData.id,
        amount: transactionData.amount,
        currency: transactionData.currency,
        timestamp: transactionData.timestamp,
      },
    };
  }

  private async createAlert(
    evaluation: RuleEvaluation,
    transactionData: TransactionData,
  ): Promise<ComplianceAlertEntity> {
    const alert = this.complianceAlertRepository.create({
      alertId: this.generateAlertId(),
      userId: transactionData.userId,
      ruleId: evaluation.rule.id,
      transactionId: transactionData.id,
      alertType: evaluation.rule.ruleType,
      priority: this.mapSeverityToPriority(evaluation.rule.severity),
      severity: evaluation.rule.severity,
      title: `Compliance Alert: ${evaluation.rule.ruleName}`,
      description: `Transaction ${transactionData.id} triggered rule: ${evaluation.rule.description}`,
      triggerData: evaluation.details,
      actionTaken: evaluation.rule.action,
      riskScore: evaluation.riskScore,
      autoGenerated: true,
    });

    return this.complianceAlertRepository.save(alert);
  }

  private mapSeverityToPriority(severity: RuleSeverity): AlertPriority {
    switch (severity) {
      case RuleSeverity.LOW:
        return AlertPriority.LOW;
      case RuleSeverity.MEDIUM:
        return AlertPriority.MEDIUM;
      case RuleSeverity.HIGH:
        return AlertPriority.HIGH;
      case RuleSeverity.CRITICAL:
        return AlertPriority.CRITICAL;
      default:
        return AlertPriority.MEDIUM;
    }
  }

  private async takeAction(
    rule: ComplianceRuleEntity,
    alert: ComplianceAlertEntity,
    transactionData: TransactionData,
  ): Promise<void> {
    switch (rule.action) {
      case ActionType.BLOCK:
        await this.blockTransaction(transactionData.id);
        break;
      case ActionType.FLAG:
        await this.flagTransaction(transactionData.id, alert.id);
        break;
      case ActionType.REQUIRE_APPROVAL:
        await this.requireApproval(transactionData.id, alert.id);
        break;
      case ActionType.NOTIFY:
        await this.sendNotification(alert, transactionData);
        break;
      case ActionType.LOG_ONLY:
        // Already logged via audit trail
        break;
    }
  }

  private async blockTransaction(transactionId: string): Promise<void> {
    this.logger.log(`Blocking transaction ${transactionId} due to compliance violation`);
    // Implementation would integrate with transaction service
  }

  private async flagTransaction(transactionId: string, alertId: string): Promise<void> {
    this.logger.log(`Flagging transaction ${transactionId} with alert ${alertId}`);
    // Implementation would update transaction status
  }

  private async requireApproval(transactionId: string, alertId: string): Promise<void> {
    this.logger.log(`Requiring approval for transaction ${transactionId} due to alert ${alertId}`);
    // Implementation would create approval workflow
  }

  private async sendNotification(alert: ComplianceAlertEntity, transactionData: TransactionData): Promise<void> {
    this.logger.log(`Sending compliance notification for alert ${alert.id}`);
    // Implementation would send email/SMS/notification
  }

  private async logAuditTrail(
    transactionData: TransactionData,
    evaluations: RuleEvaluation[],
  ): Promise<void> {
    const triggeredRules = evaluations.filter(e => e.triggered).map(e => e.rule.id);

    const audit = this.auditTrailRepository.create({
      auditId: this.generateAuditId(),
      userId: transactionData.userId,
      action: AuditAction.TRANSACTION,
      resourceType: ResourceType.TRANSACTION,
      resourceId: transactionData.id,
      status: triggeredRules.length > 0 ? AuditStatus.FAILURE : AuditStatus.SUCCESS,
      description: `Compliance monitoring for transaction ${transactionData.id}`,
      metadata: {
        triggeredRules,
        totalRules: evaluations.length,
        riskScore: Math.max(...evaluations.map(e => e.riskScore)),
      },
      ipAddress: transactionData.ipAddress,
      userAgent: transactionData.userAgent,
      isSensitiveOperation: triggeredRules.length > 0,
    });

    await this.auditTrailRepository.save(audit);
  }

  private async loadComplianceData(): Promise<void> {
    // Load watchlist and sanctioned countries
    // In production, this would fetch from external compliance databases
    this.watchlist.add('SANCTIONED_ENTITY_1');
    this.watchlist.add('SANCTIONED_ENTITY_2');
    
    this.sanctionedCountries.add('XX');
    this.sanctionedCountries.add('YY');
  }

  private generateAlertId(): string {
    return `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `AUDIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock methods - in production, these would query actual databases
  private async calculateUserVolume(userId: string, periodStart: Date, currency?: string): Promise<number> {
    // Mock calculation
    return Math.random() * 100000;
  }

  private async calculateUserTransactionCount(userId: string, periodStart: Date): Promise<number> {
    // Mock calculation
    return Math.floor(Math.random() * 50);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async updateComplianceData(): Promise<void> {
    this.logger.log('Updating compliance data...');
    await this.loadComplianceData();
  }

  async getActiveAlerts(userId?: string): Promise<ComplianceAlertEntity[]> {
    const where: any = { status: AlertStatus.OPEN };
    if (userId) {
      where.userId = userId;
    }

    return this.complianceAlertRepository.find({
      where,
      relations: ['rule', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async resolveAlert(alertId: string, resolutionDetails: string, resolvedBy: string): Promise<void> {
    await this.complianceAlertRepository.update(alertId, {
      status: AlertStatus.RESOLVED,
      resolutionDetails,
      resolvedBy,
      resolvedAt: new Date(),
    });
  }

  async grantKycClearance(userDid: string, kycTier: number, fullName: string, dob: string): Promise<any> {
    this.logger.log(`Granting KYC clearance Verifiable Credential for DID ${userDid}`);
    // Internally mints an encrypted JSON payload verifying their compliance tier
    const vc = await this.vcIssuerService.issueKycCredential(userDid, kycTier, fullName, dob);
    return vc;
  }
}