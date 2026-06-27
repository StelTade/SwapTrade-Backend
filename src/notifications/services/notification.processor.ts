import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueName } from '../../queue/queue.constants';
import { Notification } from '../entities/notification.entity';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { PushService } from './push.service';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

@Processor(QueueName.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly maxRetries = 5;
  private readonly fallbackChannels: Record<string, NotificationChannel[]> = {
    [NotificationChannel.EMAIL]: [NotificationChannel.PUSH],
    [NotificationChannel.SMS]: [NotificationChannel.PUSH],
  };

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly pushService: PushService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Process('send')
  async processNotification(job: Job<{ notificationId: string }>) {
    const { notificationId } = job.data;
    const notification = await this.notificationRepository.findOneBy({
      id: notificationId,
    });

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found`);
      return;
    }

    try {
      await this.notificationRepository.update(notificationId, {
        status: NotificationStatus.PROCESSING,
      });

      this.logger.log(
        `Processing notification ${notificationId} of type ${notification.channel}`,
      );

      let success = false;
      
      success = await this.sendViaChannel(notification);

      // Failover: if the primary channel failed, try fallback channels
      if (!success) {
        const fallbacks = this.fallbackChannels[notification.channel] || [];
        for (const fallbackChannel of fallbacks) {
          this.logger.warn(
            `Primary channel ${notification.channel} failed for notification ${notification.id}, attempting failover to ${fallbackChannel}`,
          );
          success = await this.sendViaChannel({ ...notification, channel: fallbackChannel });
          if (success) {
            await this.notificationRepository.update(notificationId, {
              metadata: { ...(notification.metadata || {}), failoverChannel: fallbackChannel } as Record<string, any>,
            });
            break;
          }
        }
      }

      if (success) {
        await this.notificationRepository.update(notificationId, {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        });
        this.logger.log(`Notification ${notificationId} sent successfully`);
      } else {
        throw new Error(
          `Failed to send notification through ${notification.channel}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process notification ${notificationId}`,
        error.stack,
      );

      const currentRetryCount = notification.retryCount;
      if (currentRetryCount < this.maxRetries) {
        await this.notificationRepository.update(notificationId, {
          status: NotificationStatus.RETRYING,
          retryCount: currentRetryCount + 1,
          lastRetryAt: new Date(),
          errorMessage: error.message,
        });

        // Exponential backoff: 1min, 5min, 15min, 1hr, 6hr
        const delayMs = this.calculateExponentialBackoff(currentRetryCount);
        this.logger.log(
          `Scheduling retry ${currentRetryCount + 1} for notification ${notificationId} in ${delayMs}ms`,
        );

        throw new Error(
          `Will retry notification ${notificationId} (attempt ${currentRetryCount + 1}/${this.maxRetries})`,
        );
      } else {
        await this.notificationRepository.update(notificationId, {
          status: NotificationStatus.PERMANENTLY_FAILED,
          errorMessage: error.message,
        });
        this.logger.error(
          `Notification ${notificationId} permanently failed after ${this.maxRetries} retries`,
        );
      }
    }
  }

  private async sendViaChannel(notification: Notification): Promise<boolean> {
    switch (notification.channel) {
      case NotificationChannel.EMAIL:
        return this.emailService.sendEmail(notification);
      case NotificationChannel.SMS:
        return this.smsService.sendSms(notification);
      case NotificationChannel.PUSH:
        return this.pushService.sendPushNotification(
          notification,
          this.notificationsGateway.getServer(),
        );
      default:
        return false;
    }
  }

  private calculateExponentialBackoff(retryNumber: number): number {
    const delays = [60000, 300000, 900000, 3600000, 21600000]; // 1min, 5min, 15min, 1hr, 6hr
    return delays[retryNumber] || delays[delays.length - 1];
  }
}
