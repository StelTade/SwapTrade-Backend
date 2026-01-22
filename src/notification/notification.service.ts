// src/notification/notification.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueService } from '../queue/queue.service';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private readonly queueService: QueueService,
  ) {}

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
}