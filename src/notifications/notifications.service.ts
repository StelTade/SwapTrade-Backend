import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createAndBroadcast(userId: string, type: NotificationType, payload: any): Promise<Notification> {
    const notification = this.notificationRepo.create({ userId, type, payload });
    await this.notificationRepo.save(notification);
    // Broadcast to user's room
    this.notificationsGateway.server.to(userId).emit('notification', {
      id: notification.id,
      type,
      payload,
      timestamp: notification.timestamp,
      read: notification.read,
    });
    return notification;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20, read?: boolean) {
    const where: any = { userId };
    if (read !== undefined) where.read = read;
    const [items, total] = await this.notificationRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.notificationRepo.update(
      { userId, id: In(notificationIds) },
      { read: true },
    );
  }
} 