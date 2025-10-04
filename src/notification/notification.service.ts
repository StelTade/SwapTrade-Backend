import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationStatus } from '../common/enums/notification-status.enum';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
  ) {}

  async getPreferences(userId: number): Promise<NotificationPreference | null> {
    return this.preferenceRepo.findOne({ where: { userId } });
  }

  async setPreferences(preferences: {
    userId: number;
    orderFilled: boolean;
    priceAlerts: boolean;
    achievementUnlocked: boolean;
  }): Promise<NotificationPreference> {
    let pref = await this.preferenceRepo.findOne({ where: { userId: preferences.userId } });
    if (!pref) {
      pref = this.preferenceRepo.create(preferences);
    } else {
      pref.orderFilled = preferences.orderFilled;
      pref.priceAlerts = preferences.priceAlerts;
      pref.achievementUnlocked = preferences.achievementUnlocked;
    }
    return this.preferenceRepo.save(pref);
  }

  private async shouldSend(userId: number, type: NotificationEventType): Promise<boolean> {
    const pref = await this.preferenceRepo.findOne({ where: { userId } });
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
}
