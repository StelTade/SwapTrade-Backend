import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { SlaPolicy } from '../entities/sla-policy.entity';
import { SlaViolation } from '../entities/sla-violation.entity';
import { InstitutionalClient } from '../entities/institutional-client.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * SLA monitoring service for institutional clients.
 *
 * Continuously evaluates SLA metrics against defined policies,
 * creates violation records when thresholds are breached,
 * and emits real-time alerts to the support team.
 *
 * Events emitted:
 *  - 'sla.violation.created' — when a new SLA violation is detected
 *  - 'sla.violation.resolved' — when an SLA violation is resolved
 *  - 'sla.warning' — when an SLA metric approaches the critical threshold
 */
@Injectable()
export class SlaMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(SlaMonitoringService.name);

  constructor(
    @InjectRepository(SlaPolicy)
    private readonly slaRepo: Repository<SlaPolicy>,
    @InjectRepository(SlaViolation)
    private readonly violationRepo: Repository<SlaViolation>,
    @InjectRepository(InstitutionalClient)
    private readonly clientRepo: Repository<InstitutionalClient>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.logger.log('SLA monitoring service initialized');
  }

  /**
   * Record a metric measurement and evaluate against SLA policies.
   *
   * @param institutionalClientId - The institutional client ID
   * @param metricType - The type of SLA metric being measured
   * @param measuredValue - The actual measured value
   */
  async recordMetric(
    institutionalClientId: string,
    metricType: string,
    measuredValue: number,
  ): Promise<void> {
    const policies = await this.slaRepo.find({
      where: {
        institutionalClientId,
        metricType: metricType as any,
        isActive: true,
      },
    });

    for (const policy of policies) {
      // Update current value
      policy.currentValue = measuredValue;
      policy.lastEvaluatedAt = new Date();

      const criticalThreshold = Number(policy.criticalThreshold);
      const warningThreshold = Number(policy.warningThreshold);
      const targetValue = Number(policy.targetValue);

      // Check for critical violation
      if (this.isViolated(measuredValue, criticalThreshold, policy.unit)) {
        policy.isViolated = true;
        policy.lastViolatedAt = new Date();

        const violation = await this.createViolation(
          policy,
          measuredValue,
          'CRITICAL',
        );

        // Emit immediate alert
        this.eventEmitter.emit('sla.violation.created', {
          violationId: violation.id,
          institutionalClientId,
          metricType,
          measuredValue,
          targetValue,
          severity: 'CRITICAL',
          timestamp: new Date(),
        });

        this.logger.warn(
          `CRITICAL SLA violation for client ${institutionalClientId}: ` +
          `${metricType} = ${measuredValue} (target: ${targetValue})`,
        );
      }
      // Check for warning
      else if (this.isViolated(measuredValue, warningThreshold, policy.unit)) {
        policy.isViolated = false; // Not a full violation yet

        this.eventEmitter.emit('sla.warning', {
          institutionalClientId,
          metricType,
          measuredValue,
          warningThreshold,
          timestamp: new Date(),
        });

        this.logger.log(
          `SLA warning for client ${institutionalClientId}: ` +
          `${metricType} = ${measuredValue} (warning: ${warningThreshold})`,
        );
      }
      // Within acceptable range
      else {
        policy.isViolated = false;
      }

      await this.slaRepo.save(policy);
    }
  }

  /**
   * Create a violation record.
   */
  private async createViolation(
    policy: SlaPolicy,
    measuredValue: number,
    severity: 'WARNING' | 'CRITICAL',
  ): Promise<SlaViolation> {
    const violation = this.violationRepo.create({
      slaPolicyId: policy.id,
      institutionalClientId: policy.institutionalClientId,
      measuredValue,
      targetValue: Number(policy.criticalThreshold),
      severity,
      isResolved: false,
    });

    return this.violationRepo.save(violation);
  }

  /**
   * Check if a measured value violates a threshold.
   *
   * For uptime/percentage metrics (unit=PERCENT): violated if measured < threshold
   * For latency/time metrics (unit=MILLISECONDS/SECONDS/MINUTES): violated if measured > threshold
   */
  private isViolated(measured: number, threshold: number, unit: string): boolean {
    if (!threshold) return false;

    if (unit === 'PERCENT') {
      // For uptime: lower is worse
      return measured < threshold;
    }
    // For latency/response time: higher is worse
    return measured > threshold;
  }

  /**
   * Resolve an SLA violation.
   */
  async resolveViolation(
    violationId: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<SlaViolation> {
    const violation = await this.violationRepo.findOne({
      where: { id: violationId },
    });
    if (!violation) {
      throw new Error(`SLA violation ${violationId} not found`);
    }

    violation.isResolved = true;
    violation.resolvedAt = new Date();
    violation.resolvedBy = resolvedBy;
    if (notes) violation.notes = notes;

    const saved = await this.violationRepo.save(violation);

    this.eventEmitter.emit('sla.violation.resolved', {
      violationId: saved.id,
      institutionalClientId: saved.institutionalClientId,
      resolvedBy,
      timestamp: new Date(),
    });

    return saved;
  }

  /**
   * Get active (unresolved) SLA violations for an institutional client.
   */
  async getActiveViolations(
    institutionalClientId: string,
  ): Promise<SlaViolation[]> {
    return this.violationRepo.find({
      where: {
        institutionalClientId,
        isResolved: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all SLA violations for an institutional client (resolved and unresolved).
   */
  async getAllViolations(
    institutionalClientId: string,
    limit = 50,
    offset = 0,
  ): Promise<SlaViolation[]> {
    return this.violationRepo.find({
      where: { institutionalClientId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get SLA policies for an institutional client.
   */
  async getSlaPolicies(
    institutionalClientId: string,
  ): Promise<SlaPolicy[]> {
    return this.slaRepo.find({
      where: { institutionalClientId, isActive: true },
      order: { metricType: 'ASC' },
    });
  }

  /**
   * Get SLA compliance summary for an institutional client.
   * Returns current SLA status and violation history.
   */
  async getSlaComplianceSummary(
    institutionalClientId: string,
  ): Promise<{
    totalPolicies: number;
    healthyPolicies: number;
    warningPolicies: number;
    violatedPolicies: number;
    activeViolations: number;
    compliancePercentage: number;
    policies: Array<{
      metricType: string;
      targetValue: number;
      currentValue: number;
      unit: string;
      status: 'HEALTHY' | 'WARNING' | 'VIOLATED';
      isViolated: boolean;
    }>;
  }> {
    const policies = await this.getSlaPolicies(institutionalClientId);
    const activeViolations = await this.getActiveViolations(institutionalClientId);

    let healthyCount = 0;
    let warningCount = 0;
    let violatedCount = 0;

    const policyDetails = policies.map((p) => {
      let status: 'HEALTHY' | 'WARNING' | 'VIOLATED' = 'HEALTHY';

      if (p.isViolated) {
        status = 'VIOLATED';
        violatedCount++;
      } else if (
        p.currentValue !== null &&
        p.warningThreshold !== null &&
        this.isViolated(Number(p.currentValue), Number(p.warningThreshold), p.unit)
      ) {
        status = 'WARNING';
        warningCount++;
      } else {
        healthyCount++;
      }

      return {
        metricType: p.metricType,
        targetValue: Number(p.targetValue),
        currentValue: Number(p.currentValue ?? 0),
        unit: p.unit,
        status,
        isViolated: p.isViolated,
      };
    });

    return {
      totalPolicies: policies.length,
      healthyPolicies: healthyCount,
      warningPolicies: warningCount,
      violatedPolicies: violatedCount,
      activeViolations: activeViolations.length,
      compliancePercentage:
        policies.length > 0
          ? Math.round((healthyCount / policies.length) * 100 * 100) / 100
          : 100,
      policies: policyDetails,
    };
  }

  /**
   * Sweep for stale violations (auto-resolve violations that are no longer active).
   * Intended for periodic cron execution.
   */
  async sweepStaleViolations(): Promise<number> {
    const staleThreshold = new Date();
    staleThreshold.setHours(staleThreshold.getHours() - 24);

    const staleViolations = await this.violationRepo.find({
      where: {
        isResolved: false,
        createdAt: LessThanOrEqual(staleThreshold),
      },
    });

    let resolvedCount = 0;
    for (const v of staleViolations) {
      // Re-check: is the SLA policy still violated?
      const policy = await this.slaRepo.findOne({ where: { id: v.slaPolicyId } });
      if (policy && !policy.isViolated) {
        v.isResolved = true;
        v.resolvedAt = new Date();
        v.resolvedBy = 'AUTO_RESOLVE';
        v.notes = 'Auto-resolved: SLA metric returned to acceptable range';
        await this.violationRepo.save(v);
        resolvedCount++;
      }
    }

    return resolvedCount;
  }
}
