import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationStatus } from '../common/enums/notification-status.enum';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BalanceUpdatedEvent, EVENTS, PortfolioMilestoneEvent, TradeExecutedEvent } from './dto/notification-event.dto';
import { NotificationType } from './entities/notification-event.entity';
import { NotificationFrequency } from './entities/user-notification-preferences.entity';
import { GetNotificationsDto } from './dto/notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly RETENTION_DAYS = 90;

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private preferencesRepo: Repository<NotificationPreference>,
  ) {}

  async getPreferences(userId: number): Promise<NotificationPreference | null> {
    return this.preferencesRepo.findOne({ where: { userId } });
  }

  async setPreferences(preferences: {
    userId: number;
    orderFilled: boolean;
    priceAlerts: boolean;
    achievementUnlocked: boolean;
  }): Promise<NotificationPreference> {
    let pref = await this.preferencesRepo.findOne({ where: { userId: preferences.userId } });
    if (!pref) {
      pref = this.preferencesRepo.create(preferences);
    } else {
      pref.orderFilled = preferences.orderFilled;
      pref.priceAlerts = preferences.priceAlerts;
      pref.achievementUnlocked = preferences.achievementUnlocked;
    }
    return this.preferencesRepo.save(pref);
  }

  private async shouldSend(userId: number, type: NotificationEventType): Promise<boolean> {
    const pref = await this.preferencesRepo.findOne({ where: { userId } });
    if (!pref) return true; // default to send when no preferences set
    switch (type) {
      case NotificationEventType.ORDER_FILLED:
        return pref.orderFilled;
      case NotificationEventType.PRICE_ALERT:
        return pref.priceAlerts;
      case NotificationEventType.ACHIEVEMENT_UNLOCKED:
        return pref.achievementUnlocked;
      default:
        return true;
    }
  }

  async sendEvent(
    userId: number,
    type: NotificationEventType,
    message: string,
  ): Promise<Notification> {
    const allowed = await this.shouldSend(userId, type);
    const status = allowed ? NotificationStatus.SENT : NotificationStatus.FAILED;
    const notification = this.notificationRepo.create({ userId, type, message, status });
    return this.notificationRepo.save(notification);
  }

  async listUserNotifications(userId: number): Promise<Notification[]> {
    return this.notificationRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async markRead(notificationId: number): Promise<Notification | null> {
    const notification = await this.notificationRepo.findOne({ where: { id: notificationId } });
    if (!notification) return null;
    notification.status = NotificationStatus.READ;
    return this.notificationRepo.save(notification);
  }

  // Event Listeners
  @OnEvent(EVENTS.TRADE_EXECUTED, { async: true })
  async handleTradeExecuted(event: TradeExecutedEvent) {
    const startTime = Date.now();
    try {
      // Create notifications for both buyer and seller
      await Promise.allSettled([
        this.createNotificationIfEnabled(event.buyerId, NotificationType.TRADE_EXECUTED, {
          role: 'buyer',
          asset: event.asset,
          amount: event.amount,
          price: event.price,
          tradeId: event.tradeId,
          timestamp: event.timestamp,
        }),
        this.createNotificationIfEnabled(event.sellerId, NotificationType.TRADE_EXECUTED, {
          role: 'seller',
          asset: event.asset,
          amount: event.amount,
          price: event.price,
          tradeId: event.tradeId,
          timestamp: event.timestamp,
        }),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`Trade notification dispatched in ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to create trade notification', error.stack);
    }
  }

  @OnEvent(EVENTS.BALANCE_UPDATED, { async: true })
  async handleBalanceUpdated(event: BalanceUpdatedEvent) {
    const startTime = Date.now();
    try {
      // Calculate percentage change
      const percentChange =
        event.previousBalance !== 0
          ? ((event.newBalance - event.previousBalance) / event.previousBalance) * 100
          : 0;

      // Only notify for significant changes (>10%)
      if (Math.abs(percentChange) >= 10) {
        await this.createNotificationIfEnabled(event.userId, NotificationType.BALANCE_UPDATED, {
          asset: event.asset,
          amount: event.amount,
          previousBalance: event.previousBalance,
          newBalance: event.newBalance,
          percentChange: percentChange.toFixed(2),
          reason: event.reason,
          timestamp: event.timestamp,
        });
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Balance notification dispatched in ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to create balance notification', error.stack);
    }
  }

  @OnEvent(EVENTS.PORTFOLIO_MILESTONE, { async: true })
  async handlePortfolioMilestone(event: PortfolioMilestoneEvent) {
    const startTime = Date.now();
    try {
      await this.createNotificationIfEnabled(event.userId, NotificationType.PORTFOLIO_MILESTONE, {
        milestone: event.milestone,
        portfolioValue: event.portfolioValue,
        previousValue: event.previousValue,
        timestamp: event.timestamp,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Milestone notification dispatched in ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to create milestone notification', error.stack);
    }
  }

  // Core Methods
  private async createNotificationIfEnabled(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
  ): Promise<Notification | null> {
    const preferences = await this.getUserPreferences(userId);

    // Check if notification type is enabled
    if (!this.isNotificationEnabled(preferences, type)) {
      this.logger.debug(`Notification ${type} disabled for user ${userId}`);
      return null;
    }

    // Check frequency preference
    if (preferences.frequency !== NotificationFrequency.INSTANT) {
      // For non-instant, queue for batch processing
      this.logger.debug(`Queuing notification for batch processing: ${preferences.frequency}`);
      // In production, you'd queue this to a job processor
    }

    // Sanitize user data
    const sanitizedData = this.sanitizeData(data);

    // Calculate expiration (90 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.RETENTION_DAYS);

    const notification = this.notificationRepo.create({
      userId: parseInt(userId, 10),
      type,
      message: JSON.stringify(sanitizedData),
      expiresAt,
    });

    return await this.notificationRepo.save(notification);
  }

  private isNotificationEnabled(preferences: NotificationPreference, type: NotificationType): boolean {
    switch (type) {
      case NotificationType.TRADE_EXECUTED:
        return preferences.orderFilled;
      case NotificationType.BALANCE_UPDATED:
        return preferences.priceAlerts;
      case NotificationType.PORTFOLIO_MILESTONE:
        return preferences.achievementUnlocked;
      default:
        return false;
    }
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    // Remove sensitive fields and sanitize data
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

    for (const field of sensitiveFields) {
      delete sanitized[field];
    }

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
        sanitized[key] = sanitized[key].substring(0, 500) + '...';
      }
    });

    return sanitized;
  }

  // API Methods
  async getNotifications(userId: string, query: GetNotificationsDto) {
    const { type, read, limit = 20, offset = 0 } = query;

    const queryBuilder = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (type !== undefined) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (read !== undefined) {
      queryBuilder.andWhere('notification.read = :read', { read });
    }

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return {
      data: notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.notificationRepo.update(
      {
        id: In(notificationIds.map(id => parseInt(id, 10))),
        userId: parseInt(userId, 10), // Ensure user can only mark their own notifications
      },
      { read: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId: parseInt(userId), read: false },
      { read: true },
    );
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference> {
    let preferences = await this.preferencesRepo.findOne({ where: { userId: parseInt(userId) } });

    if (!preferences) {
      // Create default preferences
      preferences = this.preferencesRepo.create({
        userId: parseInt(userId),
        frequency: NotificationFrequency.INSTANT,
        channels: ['in-app', 'email'],
        orderFilled: true,
        priceAlerts: true,
        achievementUnlocked: true,
      });
      preferences = await this.preferencesRepo.save(preferences);
    }

    return preferences;
  }

  async updatePreferences(userId: string, updates: UpdatePreferencesDto): Promise<NotificationPreference> {
    let preferences = await this.getUserPreferences(userId);
    Object.assign(preferences, updates);
    return await this.preferencesRepo.save(preferences);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepo.count({
      where: { userId: parseInt(userId), read: false },
    });
  }

  // Cleanup expired notifications
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredNotifications() {
    const result = await this.notificationRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Cleaned up ${result.affected} expired notifications`);
  }
}
