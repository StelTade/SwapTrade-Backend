import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { QueueName } from '../../queue/queue.constants';
import { Notification } from '../entities/notification.entity';
import { UserNotificationPreferences } from '../entities/user-notification-preferences.entity';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { UpdateNotificationPreferencesDto } from '../dto/update-notification-preferences.dto';
import { TemplatesService } from './templates.service';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { defaultPreferences } from '../config/default-preferences.config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(UserNotificationPreferences)
    private readonly preferencesRepository: Repository<UserNotificationPreferences>,
    @InjectQueue(QueueName.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    private readonly templatesService: TemplatesService,
  ) {}

  async sendNotification(sendNotificationDto: SendNotificationDto) {
    const { userId, type, data, language, forceChannels } = sendNotificationDto;

    // Get or create user preferences
    let preferences = await this.preferencesRepository.findOneBy({ userId });
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
        preferredLanguage: language || 'en',
        preferences: defaultPreferences,
        allNotificationsEnabled: true,
      });
      await this.preferencesRepository.save(preferences);
    }

    const userLang = language || preferences.preferredLanguage;
    const eventPrefs = preferences.preferences[type];

    if (!eventPrefs) {
      this.logger.warn(
        `No preferences found for event type ${type}, using defaults`,
      );
      return;
    }

    if (!preferences.allNotificationsEnabled) {
      this.logger.log(
        `All notifications disabled for user ${userId}, skipping`,
      );
      return;
    }

    // Process each enabled channel
    const channelsToProcess =
      forceChannels || this.getEnabledChannels(eventPrefs);

    for (const channel of channelsToProcess) {
      if (!eventPrefs[channel]?.enabled && !forceChannels?.includes(channel)) {
        continue;
      }

      // Validate recipient information exists for this channel
      const recipient = this.getRecipientForChannel(preferences, channel);
      if (!recipient && channel !== NotificationChannel.PUSH) {
        this.logger.warn(
          `No recipient found for channel ${channel} for user ${userId}`,
        );
        continue;
      }

      // Render template
      const { subject, body } = await this.templatesService.renderTemplate(
        type,
        channel,
        data,
        userLang,
      );

      // Create notification record
      const notification = this.notificationRepository.create({
        userId,
        type,
        channel,
        status: NotificationStatus.PENDING,
        data,
        recipient:
          channel === NotificationChannel.PUSH
            ? undefined
            : recipient || undefined,
        subject,
        body,
        retryCount: 0,
      });

      const savedNotification =
        await this.notificationRepository.save(notification);

      // Add to queue for processing
      await this.notificationsQueue.add(
        'send',
        {
          notificationId: savedNotification.id,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(
        `Notification ${savedNotification.id} queued for ${channel} to user ${userId}`,
      );
    }
  }

  async getUserPreferences(
    userId: string,
  ): Promise<UserNotificationPreferences> {
    let preferences = await this.preferencesRepository.findOneBy({ userId });
    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
        preferredLanguage: 'en',
        preferences: defaultPreferences,
        allNotificationsEnabled: true,
      });
      await this.preferencesRepository.save(preferences);
    }
    return preferences;
  }

  async updatePreferences(
    userId: string,
    updateDto: UpdateNotificationPreferencesDto,
  ): Promise<UserNotificationPreferences> {
    let preferences = await this.preferencesRepository.findOneBy({ userId });

    if (!preferences) {
      preferences = this.preferencesRepository.create({
        userId,
        preferredLanguage: 'en',
        preferences: defaultPreferences,
        allNotificationsEnabled: true,
      });
    }

    Object.assign(preferences, updateDto);

    // Merge preferences if they're being updated
    if (updateDto.preferences) {
      preferences.preferences = {
        ...preferences.preferences,
        ...updateDto.preferences,
      };
    }

    return this.preferencesRepository.save(preferences);
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return { notifications, total };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOneBy({
      id: notificationId,
      userId,
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  private getEnabledChannels(eventPrefs: any): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    Object.entries(eventPrefs).forEach(([channel, prefs]: [string, any]) => {
      if (prefs?.enabled) {
        channels.push(channel as NotificationChannel);
      }
    });
    return channels;
  }

  private getRecipientForChannel(
    preferences: UserNotificationPreferences,
    channel: NotificationChannel,
  ): string | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return preferences.email;
      case NotificationChannel.SMS:
        return preferences.phoneNumber;
      case NotificationChannel.PUSH:
        return null; // Push uses socket connections
      default:
        return null;
    }
  }
}
