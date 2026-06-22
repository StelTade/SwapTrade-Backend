import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { MobileDevice } from '../entities/mobile-device.entity';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly fcmUrl =
    'https://fcm.googleapis.com/v1/projects/{projectId}/messages:send';

  constructor(
    @InjectRepository(MobileDevice)
    private readonly deviceRepo: Repository<MobileDevice>,
    private readonly configService: ConfigService,
  ) {}

  async sendToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
    const devices = await this.deviceRepo.find({
      where: { userId, notificationsEnabled: true },
    });

    if (!devices.length) return { sent: 0, failed: 0 };

    const results = await Promise.allSettled(
      devices.map((d) => this.sendToToken(d.fcmToken, payload)),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    return { sent, failed };
  }

  async sendToToken(token: string, payload: PushPayload): Promise<void> {
    const serverKey = this.configService.get<string>('FCM_SERVER_KEY');
    if (!serverKey) {
      this.logger.warn('FCM_SERVER_KEY not configured — skipping push');
      return;
    }

    const message = {
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: {
          ...(payload.data ?? {}),
          ...(payload.deepLink ? { deepLink: payload.deepLink } : {}),
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      },
    };

    try {
      const projectId = this.configService.get<string>('FCM_PROJECT_ID');
      const url = this.fcmUrl.replace('{projectId}', projectId ?? '');
      await axios.post(url, message, {
        headers: {
          Authorization: `Bearer ${serverKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FCM send failed for token ${token.slice(0, 8)}…: ${msg}`);

      // Remove stale tokens (NotRegistered / InvalidRegistration)
      if (msg.includes('NotRegistered') || msg.includes('InvalidRegistration')) {
        await this.deviceRepo.delete({ fcmToken: token });
      }
      throw err;
    }
  }
}
