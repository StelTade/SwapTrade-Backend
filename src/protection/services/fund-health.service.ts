import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFund } from '../entities/insurance-fund.entity';
import { FundHealthStatus } from '../enums/fund-health-status.enum';
import { FundHealthAlertEvent } from '../../infrastructure/events/domain.events';

export const HEALTH_WARNING_THRESHOLD = 20;

export interface FundHealthMetrics {
  fundId: number;
  tier: string;
  asset: string;
  balance: number;
  targetReserve: number;
  healthPercent: number;
  healthStatus: FundHealthStatus;
  isBelowThreshold: boolean;
}

export interface FundHealthDashboard {
  overallHealthPercent: number;
  overallStatus: FundHealthStatus;
  activeAlerts: number;
  funds: FundHealthMetrics[];
  alerts: FundHealthMetrics[];
}

@Injectable()
export class FundHealthService {
  constructor(
    @InjectRepository(InsuranceFund)
    private readonly fundRepo: Repository<InsuranceFund>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  calculateHealthPercent(balance: number, targetReserve: number): number {
    if (targetReserve <= 0) return 100;
    return Math.min(100, (balance / targetReserve) * 100);
  }

  resolveHealthStatus(healthPercent: number): FundHealthStatus {
    if (healthPercent <= 0) return FundHealthStatus.DEPLETED;
    if (healthPercent < HEALTH_WARNING_THRESHOLD)
      return FundHealthStatus.CRITICAL;
    if (healthPercent < 50) return FundHealthStatus.WARNING;
    return FundHealthStatus.HEALTHY;
  }

  async updateFundHealth(fundId: number): Promise<InsuranceFund> {
    const fund = await this.fundRepo.findOne({
      where: { id: fundId },
      relations: ['tier'],
    });
    if (!fund) {
      throw new Error(`Fund ${fundId} not found`);
    }

    const previousPercent = Number(fund.healthPercent);
    const healthPercent = this.calculateHealthPercent(
      Number(fund.balance),
      Number(fund.targetReserve),
    );
    const healthStatus = this.resolveHealthStatus(healthPercent);

    fund.healthPercent = healthPercent;
    fund.healthStatus = healthStatus;

    const saved = await this.fundRepo.save(fund);

    if (
      healthPercent < HEALTH_WARNING_THRESHOLD &&
      previousPercent >= HEALTH_WARNING_THRESHOLD
    ) {
      this.eventEmitter.emit(
        'fund.health.alert',
        new FundHealthAlertEvent(
          fund.id,
          fund.tier?.tier ?? 'UNKNOWN',
          healthPercent,
          Number(fund.balance),
          Number(fund.targetReserve),
        ),
      );
    }

    return saved;
  }

  async getFundMetrics(fundId: number): Promise<FundHealthMetrics> {
    const fund = await this.fundRepo.findOne({
      where: { id: fundId },
      relations: ['tier'],
    });
    if (!fund) {
      throw new Error(`Fund ${fundId} not found`);
    }
    return this.toMetrics(fund);
  }

  async getDashboard(): Promise<FundHealthDashboard> {
    const funds = await this.fundRepo.find({ relations: ['tier'] });
    const metrics = funds.map((f) => this.toMetrics(f));
    const alerts = metrics.filter((m) => m.isBelowThreshold);

    const totalBalance = metrics.reduce((s, m) => s + m.balance, 0);
    const totalTarget = metrics.reduce((s, m) => s + m.targetReserve, 0);
    const overallHealthPercent = this.calculateHealthPercent(
      totalBalance,
      totalTarget,
    );

    return {
      overallHealthPercent,
      overallStatus: this.resolveHealthStatus(overallHealthPercent),
      activeAlerts: alerts.length,
      funds: metrics,
      alerts,
    };
  }

  async getActiveAlerts(): Promise<FundHealthMetrics[]> {
    const dashboard = await this.getDashboard();
    return dashboard.alerts;
  }

  private toMetrics(fund: InsuranceFund): FundHealthMetrics {
    const healthPercent = Number(fund.healthPercent);
    return {
      fundId: fund.id,
      tier: fund.tier?.tier ?? 'UNKNOWN',
      asset: fund.asset,
      balance: Number(fund.balance),
      targetReserve: Number(fund.targetReserve),
      healthPercent,
      healthStatus: fund.healthStatus,
      isBelowThreshold: healthPercent < HEALTH_WARNING_THRESHOLD,
    };
  }
}
