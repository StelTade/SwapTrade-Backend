import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  Notification,
  NotificationChannel,
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import {
  NotificationJob,
  NotificationJobStatus,
} from './entities/notification-job.entity';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import * as Handlebars from 'handlebars';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationStatus } from '../common/enums/notification-status.enum';
import { AuditNotifierService } from 'src/audit-log/audit-notifier.service';

interface DeliveryContext {
  [key: string]: unknown;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(AuditNotifierService.name);
  private mailer: any;
  private twilioClient: any;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationJob)
    private readonly jobRepo: Repository<NotificationJob>,
  ) {
    this.mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
    );
  }

  async send(dto: SendNotificationDto, context: DeliveryContext = {}) {
    const channels = dto.channels ?? [
      NotificationChannel.Email,
      NotificationChannel.InApp,
    ];
    if (!Array.isArray(channels) || channels.length === 0) {
      throw new BadRequestException('At least one channel is required');
    }

    const notification = this.notificationRepo.create({
      userId: dto.userId,
      type: dto.type,
      channels,
      subject: dto.subject ?? null,
      message: dto.message,
      status: NotificationStatus.SENT,
      metadata: context,
      templateKey: dto.templateKey ?? null,
    });
    const saved = await this.notificationRepo.save(notification);

    const jobs = channels.map((channel) =>
      this.jobRepo.create({
        notificationId: saved.id,
        status: NotificationJobStatus.Pending,
        attempt: 0,
        nextRunAt: new Date(),
      }),
    );
    await this.jobRepo.save(jobs);

    return saved;
  }

  async sendEvent(userId: number, type: string, message: string) {
    return this.send({
      userId,
      type,
      message,
    });
  }

  async processPendingBatch(limit = 50) {
    const now = new Date();
    const jobs = await this.jobRepo.find({
      where: {
        status: NotificationJobStatus.Pending,
        nextRunAt: MoreThan(new Date(0)),
      },
      take: limit,
    });

    for (const job of jobs) {
      await this.processJob(job);
    }
  }

  private async processJob(job: NotificationJob) {
    const notification = await this.notificationRepo.findOne({
      where: { id: job.notificationId },
    });
    if (!notification) {
      job.status = NotificationJobStatus.Failed;
      job.lastError = 'Notification not found';
      await this.jobRepo.save(job);
      return;
    }

    const channels = notification.channels ?? [];
    for (const channel of channels) {
      const allowed = await this.isChannelAllowed(
        notification.userId,
        notification.type,
        channel,
      );
      if (!allowed) {
        continue;
      }

      try {
        if (channel === NotificationChannel.Email) {
          await this.deliverEmail(notification);
        } else if (channel === NotificationChannel.Sms) {
          await this.deliverSms(notification);
        } else if (channel === NotificationChannel.InApp) {
          await this.deliverInApp(notification);
        } else if (channel === NotificationChannel.Push) {
          await this.deliverPush(notification);
        }
      } catch (error) {
        await this.scheduleRetry(job, error);
        notification.status = NotificationStatus.FAILED;
        notification.lastError =
          error instanceof Error ? error.message : String(error);
        await this.notificationRepo.save(notification);
        return;
      }
    }

    notification.status = NotificationStatus.SENT;
    notification.deliveredAt = new Date();
    await this.notificationRepo.save(notification);
    job.status = NotificationJobStatus.Completed;
    await this.jobRepo.save(job);
  }

  private async scheduleRetry(job: NotificationJob, error: unknown) {
    const maxAttempts = 5;
    if (job.attempt >= maxAttempts) {
      job.status = NotificationJobStatus.Failed;
      job.lastError = error instanceof Error ? error.message : String(error);
      await this.jobRepo.save(job);
      return;
    }
    const nextAttempt = job.attempt + 1;
    const delayMs = 1000 * Math.pow(2, nextAttempt);
    job.attempt = nextAttempt;
    job.status = NotificationJobStatus.Scheduled;
    job.nextRunAt = new Date(Date.now() + delayMs);
    job.lastError = error instanceof Error ? error.message : String(error);
    await this.jobRepo.save(job);
  }

  async notifyAdmins(payload: {
    title: string;
    body: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    this.logger.warn(`[ADMIN ALERT] ${payload.title}: ${payload.body}`);
    // plug in email/Slack/webhook here
  }

  private async isChannelAllowed(
    userId: number,
    type: string,
    channel: NotificationChannel,
  ) {
    const preference = await this.preferenceRepo.findOne({
      where: { userId, type, channel },
    });
    if (!preference) {
      return true;
    }
    if (!preference.enabled) {
      return false;
    }

    if (preference.dailyLimit > 0) {
      const now = new Date();
      const last = preference.lastSentAt;
      const sameDay =
        last &&
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate();
      if (sameDay && preference.sentToday >= preference.dailyLimit) {
        return false;
      }
    }

    preference.sentToday += 1;
    preference.lastSentAt = new Date();
    await this.preferenceRepo.save(preference);
    return true;
  }

  private async resolveTemplate(notification: Notification) {
    if (!notification.templateKey) {
      return {
        subject: notification.subject ?? '',
        body: notification.message,
      };
    }
    const template = await this.templateRepo.findOne({
      where: { key: notification.templateKey },
    });
    if (!template) {
      return {
        subject: notification.subject ?? '',
        body: notification.message,
      };
    }

    const compiled = Handlebars.compile(template.body);
    const metadata = notification.metadata ?? {};
    const body = compiled(metadata);
    return {
      subject: template.subject ?? notification.subject ?? '',
      body,
    };
  }

  private async deliverEmail(notification: Notification) {
    const { subject, body } = await this.resolveTemplate(notification);
    const to = notification.metadata?.email as string | undefined;
    if (!to) {
      throw new BadRequestException('Missing email address in metadata');
    }

    const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const unsubscribeToken =
      notification.metadata?.unsubscribeToken ?? notification.templateKey;
    const unsubscribeUrl = `${baseUrl}/notification/unsubscribe?token=${encodeURIComponent(
      String(unsubscribeToken ?? ''),
    )}`;

    const finalBody = `${body}\n\nTo manage preferences, visit: ${unsubscribeUrl}`;

    await this.mailer.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text: finalBody,
    });
  }

  private async deliverSms(notification: Notification) {
    const { body } = await this.resolveTemplate(notification);
    const to = notification.metadata?.phone as string | undefined;
    if (!to) {
      throw new BadRequestException('Missing phone number in metadata');
    }
    const from = process.env.TWILIO_FROM_NUMBER ?? '';
    if (!from) {
      throw new BadRequestException('Missing Twilio from number');
    }

    await this.twilioClient.messages.create({
      body,
      to,
      from,
    });
  }

  private async deliverInApp(notification: Notification) {}

  private async deliverPush(notification: Notification) {}

  async getPreferences(userId: number) {
    return this.preferenceRepo.find({ where: { userId } });
  }

  async updatePreferences(
    userId: number,
    updates: {
      type: string;
      channel: NotificationChannel;
      enabled: boolean;
    }[],
  ) {
    const results: NotificationPreference[] = [];
    for (const update of updates) {
      let preference = await this.preferenceRepo.findOne({
        where: { userId, type: update.type, channel: update.channel },
      });
      if (!preference) {
        preference = this.preferenceRepo.create({
          userId,
          type: update.type,
          channel: update.channel,
          enabled: update.enabled,
        });
      } else {
        preference.enabled = update.enabled;
      }
      if (!preference.unsubscribeToken) {
        preference.unsubscribeToken = this.generateUnsubscribeToken(
          userId,
          update.type,
          update.channel,
        );
      }
      results.push(await this.preferenceRepo.save(preference));
    }
    return results;
  }

  async unsubscribeByToken(token: string) {
    const preference = await this.preferenceRepo.findOne({
      where: { unsubscribeToken: token },
    });
    if (!preference) {
      throw new NotFoundException('Unsubscribe token not found');
    }
    preference.enabled = false;
    await this.preferenceRepo.save(preference);
    return { success: true };
  }

  private generateUnsubscribeToken(
    userId: number,
    type: string,
    channel: NotificationChannel,
  ) {
    const base = `${userId}:${type}:${channel}:${Date.now()}`;
    return Buffer.from(base).toString('base64url');
  }
}
