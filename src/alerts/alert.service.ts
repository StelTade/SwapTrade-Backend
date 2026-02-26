import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertStatus } from './entities/alert-rule.entity';
import { AlertTriggeredEvent } from './entities/alert-triggered-event.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { ResourceNotFoundException } from '../common/exceptions';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(AlertRule)
    private readonly alertRepo: Repository<AlertRule>,
    @InjectRepository(AlertTriggeredEvent)
    private readonly triggerEventRepo: Repository<AlertTriggeredEvent>,
  ) {}

  async createAlert(userId: number, dto: CreateAlertDto): Promise<AlertRule> {
    const rule = this.alertRepo.create({
      userId,
      name: dto.name,
      type: dto.type,
      status: AlertStatus.ACTIVE,
      asset: dto.asset ?? null,
      operator: dto.operator ?? null,
      threshold: dto.threshold ?? null,
      changeType: dto.changeType ?? null,
      changeThreshold: dto.changeThreshold ?? null,
      referenceValue: null,
      channels: dto.channels,
      cooldownMinutes: dto.cooldownMinutes ?? 60,
      lastTriggeredAt: null,
      triggerCount: 0,
    });
    const saved = await this.alertRepo.save(rule);
    this.logger.log(`Alert created: id=${saved.id} userId=${userId} type=${dto.type}`);
    return saved;
  }

  async getAlerts(userId: number): Promise<AlertRule[]> {
    return this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAlert(userId: number, alertId: number): Promise<AlertRule> {
    const rule = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!rule) {
      throw new ResourceNotFoundException('AlertRule', alertId);
    }
    if (rule.userId !== userId) {
      throw new ForbiddenException('You do not own this alert');
    }
    return rule;
  }

  async updateAlert(
    userId: number,
    alertId: number,
    dto: UpdateAlertDto,
  ): Promise<AlertRule> {
    const rule = await this.getAlert(userId, alertId);
    Object.assign(rule, dto);
    return this.alertRepo.save(rule);
  }

  async deleteAlert(userId: number, alertId: number): Promise<void> {
    const rule = await this.getAlert(userId, alertId);
    await this.alertRepo.remove(rule);
    this.logger.log(`Alert deleted: id=${alertId} userId=${userId}`);
  }

  async pauseAlert(userId: number, alertId: number): Promise<AlertRule> {
    const rule = await this.getAlert(userId, alertId);
    rule.status = AlertStatus.PAUSED;
    return this.alertRepo.save(rule);
  }

  async resumeAlert(userId: number, alertId: number): Promise<AlertRule> {
    const rule = await this.getAlert(userId, alertId);
    rule.status = AlertStatus.ACTIVE;
    return this.alertRepo.save(rule);
  }

  async getAlertHistory(
    userId: number,
    alertId: number,
    limit = 50,
    offset = 0,
  ): Promise<AlertTriggeredEvent[]> {
    await this.getAlert(userId, alertId);
    return this.triggerEventRepo.find({
      where: { alertId, userId },
      order: { triggeredAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async recordTrigger(
    rule: AlertRule,
    triggerValue: number,
    notificationId: number | null,
  ): Promise<void> {
    const event = this.triggerEventRepo.create({
      alertId: rule.id,
      userId: rule.userId,
      triggerValue,
      notificationId,
      channel: rule.channels[0] ?? null,
    });
    await this.triggerEventRepo.save(event);

    rule.lastTriggeredAt = new Date();
    rule.triggerCount += 1;
    rule.status = AlertStatus.TRIGGERED;
    await this.alertRepo.save(rule);

    this.logger.log(
      `Alert triggered: id=${rule.id} userId=${rule.userId} value=${triggerValue}`,
    );
  }

  async findActiveRulesForAsset(
    asset: string,
    types: string[],
  ): Promise<AlertRule[]> {
    return this.alertRepo
      .createQueryBuilder('rule')
      .where('rule.asset = :asset', { asset })
      .andWhere('rule.type IN (:...types)', { types })
      .andWhere('rule.status = :status', { status: AlertStatus.ACTIVE })
      .getMany();
  }

  async findActivePortfolioRules(userId: number): Promise<AlertRule[]> {
    return this.alertRepo
      .createQueryBuilder('rule')
      .where('rule.userId = :userId', { userId })
      .andWhere('rule.type = :type', { type: 'PORTFOLIO_CHANGE' })
      .andWhere('rule.status = :status', { status: AlertStatus.ACTIVE })
      .getMany();
  }

  async updateReferenceValue(alertId: number, value: number): Promise<void> {
    await this.alertRepo.update(alertId, { referenceValue: value });
  }
}
