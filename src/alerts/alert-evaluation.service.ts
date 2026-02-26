import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  AlertRule,
  AlertType,
  AlertOperator,
  PortfolioChangeType,
} from './entities/alert-rule.entity';
import { AlertService } from './alert.service';
import { NotificationChannel } from '../notification/entities/notification.entity';
import type {
  MarketDataUpdate,
  PortfolioUpdate,
} from '../websocket/interfaces/websocket.interfaces';
import { QueueName } from '../queue/queue.constants';

export interface AlertFireJobData {
  alertId: number;
  userId: number;
  triggerValue: number;
  message: string;
  channels: NotificationChannel[];
  alertName: string;
}

@Injectable()
export class AlertEvaluationService {
  private readonly logger = new Logger(AlertEvaluationService.name);

  constructor(
    private readonly alertService: AlertService,
    @InjectQueue(QueueName.ALERTS)
    private readonly alertsQueue: Queue<AlertFireJobData>,
  ) {}

  @OnEvent('market.data.updated', { async: true })
  async handleMarketDataUpdated(data: MarketDataUpdate): Promise<void> {
    try {
      const rules = await this.alertService.findActiveRulesForAsset(data.asset, [
        AlertType.PRICE,
        AlertType.VOLUME,
      ]);

      for (const rule of rules) {
        if (!this.isCooldownExpired(rule)) continue;

        const currentValue =
          rule.type === AlertType.PRICE ? data.price : data.volume24h;

        if (this.evaluateCondition(currentValue, rule.operator!, rule.threshold!)) {
          await this.enqueueAlertFiring(rule, currentValue);
        }
      }
    } catch (error) {
      this.logger.error('Error evaluating market.data.updated alerts:', error);
    }
  }

  @OnEvent('user.portfolio.updated', { async: true })
  async handlePortfolioUpdated(data: PortfolioUpdate): Promise<void> {
    try {
      const userId = Number(data.userId);
      const rules = await this.alertService.findActivePortfolioRules(userId);

      for (const rule of rules) {
        if (!this.isCooldownExpired(rule)) continue;

        if (rule.referenceValue === null || rule.referenceValue === undefined) {
          await this.alertService.updateReferenceValue(rule.id, data.totalValue);
          continue;
        }

        if (this.evaluatePortfolioCondition(rule, data.totalValue)) {
          await this.enqueueAlertFiring(rule, data.totalValue);
          await this.alertService.updateReferenceValue(rule.id, data.totalValue);
        }
      }
    } catch (error) {
      this.logger.error('Error evaluating user.portfolio.updated alerts:', error);
    }
  }

  private evaluateCondition(
    currentValue: number,
    operator: AlertOperator,
    threshold: number,
  ): boolean {
    switch (operator) {
      case AlertOperator.GT:
        return currentValue > threshold;
      case AlertOperator.LT:
        return currentValue < threshold;
      case AlertOperator.GTE:
        return currentValue >= threshold;
      case AlertOperator.LTE:
        return currentValue <= threshold;
      default:
        return false;
    }
  }

  private evaluatePortfolioCondition(rule: AlertRule, currentValue: number): boolean {
    const ref = Number(rule.referenceValue);
    if (!ref || ref === 0) return false;

    const changeThreshold = Number(rule.changeThreshold) ?? 0;

    const change =
      rule.changeType === PortfolioChangeType.PERCENTAGE
        ? Math.abs((currentValue - ref) / ref) * 100
        : Math.abs(currentValue - ref);

    return change >= changeThreshold;
  }

  private isCooldownExpired(rule: AlertRule): boolean {
    if (!rule.lastTriggeredAt) return true;
    const cooldownMs = rule.cooldownMinutes * 60 * 1000;
    return Date.now() - new Date(rule.lastTriggeredAt).getTime() >= cooldownMs;
  }

  private async enqueueAlertFiring(rule: AlertRule, triggerValue: number): Promise<void> {
    const message = this.buildAlertMessage(rule, triggerValue);

    await this.alertsQueue.add(
      'fire-alert',
      {
        alertId: rule.id,
        userId: rule.userId,
        triggerValue,
        message,
        channels: rule.channels,
        alertName: rule.name,
      },
      {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
      },
    );

    this.logger.log(
      `Alert queued: alertId=${rule.id} userId=${rule.userId} value=${triggerValue}`,
    );
  }

  private buildAlertMessage(rule: AlertRule, triggerValue: number): string {
    switch (rule.type) {
      case AlertType.PRICE:
        return `Price alert "${rule.name}": ${rule.asset} is now ${triggerValue} (condition: ${rule.operator} ${rule.threshold})`;
      case AlertType.VOLUME:
        return `Volume alert "${rule.name}": ${rule.asset} 24h volume is ${triggerValue} (condition: ${rule.operator} ${rule.threshold})`;
      case AlertType.PORTFOLIO_CHANGE:
        return `Portfolio alert "${rule.name}": your portfolio value is now ${triggerValue} (change threshold: ${rule.changeThreshold}${rule.changeType === PortfolioChangeType.PERCENTAGE ? '%' : ''})`;
      default:
        return `Alert "${rule.name}" triggered: current value is ${triggerValue}`;
    }
  }
}
