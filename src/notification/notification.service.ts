// src/notification/notification.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationStatus } from '../common/enums/notification-status.enum';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
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
    private readonly queueService: QueueService,
  ) {}

  /**
   * Generic method to send a notification event
   */
  async sendEvent(
    userId: number,
    eventType: NotificationEventType,
    message: string,
  ): Promise<void> {
    try {
      // Map eventType to appropriate notification type
      let notificationType: 'trade_completed' | 'trade_disputed' | 'message_received' | 'system_alert';
      switch (eventType) {
        case NotificationEventType.ORDER_FILLED:
          notificationType = 'trade_completed';
          break;
        case NotificationEventType.ACHIEVEMENT_UNLOCKED:
          notificationType = 'system_alert';
          break;
        case NotificationEventType.PRICE_ALERT:
          notificationType = 'system_alert';
          break;
        default:
          notificationType = 'system_alert';
      }

      await this.queueService.addNotificationJob({
        userId: String(userId),
        type: notificationType,
        title: this.getNotificationTitle(eventType),
        message,
        priority: 'normal',
      });

      this.logger.log(`Notification of type ${eventType} queued for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue notification of type ${eventType} for user ${userId}:`, error);
      throw error;
    }
  }

  private getNotificationTitle(eventType: NotificationEventType): string {
    switch (eventType) {
      case NotificationEventType.ORDER_FILLED:
        return 'Order Filled';
      case NotificationEventType.ACHIEVEMENT_UNLOCKED:
        return 'Achievement Unlocked';
      case NotificationEventType.PRICE_ALERT:
        return 'Price Alert';
      default:
        return 'Notification';
    }
  }

  /**
   * Send trade completed notification (queued)
   */
  async notifyTradeCompleted(
    userId: number,
    tradeDetails: {
      tradeId: string;
      fromToken: string;
      toToken: string;
      amount: number;
    },
  ): Promise<void> {
    try {
      await this.queueService.addNotificationJob({
        userId: String(userId),
        type: 'trade_completed',
        title: 'Trade Completed',
        message: `Your trade of ${tradeDetails.amount} ${tradeDetails.fromToken} to ${tradeDetails.toToken} has been completed successfully.`,
        data: tradeDetails,
        priority: 'high',
      });

      this.logger.log(`Trade completed notification queued for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to queue trade notification:', error);
      throw error;
    }
  }

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

  /**
   * Send trade dispute notification (queued)
   */
  async notifyTradeDispute(
    userId: number,
    tradeId: string,
    reason: string,
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      userId: String(userId),
      type: 'trade_disputed',
      title: 'Trade Disputed',
      message: `Your trade #${tradeId} has been disputed: ${reason}`,
      data: { tradeId, reason },
      priority: 'high',
    });
  }

  /**
   * Send new message notification (queued)
   */
  async notifyNewMessage(
    userId: number,
    fromUser: string,
    messagePreview: string,
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      userId: String(userId),
      type: 'message_received',
      title: 'New Message',
      message: `${fromUser}: ${messagePreview}`,
      data: { fromUser },
      priority: 'normal',
    });
  }

  /**
   * Send system alert notification (queued)
   */
  async notifySystemAlert(
    userId: number,
    alertMessage: string,
    severity: 'info' | 'warning' | 'critical' = 'info',
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      userId: String(userId),
      type: 'system_alert',
      title: 'System Alert',
      message: alertMessage,
      data: { severity },
      priority: severity === 'critical' ? 'high' : 'normal',
    });
  }

  /**
   * Send bulk notifications (e.g., maintenance announcement)
   */
  async notifyAllUsers(
    title: string,
    message: string,
    userIds: number[],
  ): Promise<void> {
    const notifications = userIds.map(userId => ({
      userId: String(userId),
      type: 'system_alert' as const,
      title,
      message,
      priority: 'normal' as const,
    }));

    await this.queueService.addBulkNotifications(notifications);
    this.logger.log(`Bulk notifications queued for ${userIds.length} users`);
  }

  /**
   * Send reward earned notification (queued)
   */
  async notifyRewardEarned(
    userId: number,
    rewardName: string,
    points: number,
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      userId: String(userId),
      type: 'system_alert',
      title: 'Reward Earned! 🎉',
      message: `You've earned ${points} points for ${rewardName}`,
      data: { rewardName, points },
      priority: 'low',
    });
  }

  /**
   * Send bid accepted notification (queued)
   */
  async notifyBidAccepted(
    userId: number,
    bidDetails: {
      bidId: string;
      amount: number;
      token: string;
    },
  ): Promise<void> {
    await this.queueService.addNotificationJob({
      userId: String(userId),
      type: 'trade_completed',
      title: 'Bid Accepted',
      message: `Your bid of ${bidDetails.amount} ${bidDetails.token} has been accepted!`,
      data: bidDetails,
      priority: 'high',
    });
  }

  // ==================== CRUD Methods ====================

  /**
   * Create a new notification
   */
  async create(createNotificationDto: any): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...createNotificationDto,
      read: false,
      sent: false,
    });
    
    const saved = await this.notificationRepo.save(notification);

    // Also queue for push notification delivery
    await this.queueService.addNotificationJob({
      userId: String(createNotificationDto.userId),
      type: createNotificationDto.type || 'system_alert',
      title: createNotificationDto.title || 'Notification',
      message: createNotificationDto.message,
      priority: createNotificationDto.priority || 'normal',
    });

    return saved as unknown as Notification;
  }

  /**
   * Find all notifications for a user
   */
  async findAllByUser(userId: number): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    }) as Promise<Notification[]>;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ 
      where: { id } 
    });
    
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    
    return await this.notificationRepo.save(notification);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: number): Promise<void> {
    const result = await this.notificationRepo.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  // ==================== Additional Helper Methods ====================

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    return await this.notificationRepo.count({
      where: { 
        userId, 
        read: false 
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ 
        read: true, 
        readAt: new Date() 
      })
      .where('userId = :userId', { userId })
      .andWhere('read = :read', { read: false })
      .execute();
  }



  /**
   * Delete all notifications for a user
   */
  async deleteAllByUser(userId: number): Promise<void> {
    await this.notificationRepo.delete({ userId });
  }

  /**
   * Get paginated notifications for a user
   */
  async findPaginated(
    userId: number,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{
    data: Notification[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (unreadOnly) {
      queryBuilder.andWhere('notification.read = :read', { read: false });
    }

    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);

    const data = await queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Get notifications by type for a user
   */
  async findByType(userId: number, type: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { 
        userId, 
        type 
      },
      order: { createdAt: 'DESC' },
    }) as Promise<Notification[]>;
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(id: number): Promise<void> {
    await this.notificationRepo.update(id, {
      sent: true,
      sentAt: new Date(),
    });
  }

  /**
   * Delete old read notifications (cleanup job)
   */
  async deleteOldReadNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationRepo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('read = :read', { read: true })
      .andWhere('readAt < :cutoffDate', { cutoffDate })
      .execute();

    this.logger.log(`Deleted ${result.affected} old notifications`);
    return result.affected || 0;
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

  // Cleanup expired notifications
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredNotifications() {
    const result = await this.notificationRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(`Cleaned up ${result.affected} expired notifications`);
  }
}
