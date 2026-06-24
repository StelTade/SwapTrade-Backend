import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio;
  private fromNumber: string;

  constructor(private configService: ConfigService) {
    this.initializeTwilio();
  }

  private initializeTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER')!;

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized');
    } else {
      this.logger.warn(
        'Twilio credentials not configured, SMS service will be unavailable',
      );
    }
  }

  async sendSms(notification: Notification): Promise<boolean> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: notification.body,
        from: this.fromNumber,
        to: notification.recipient,
      });

      this.logger.log(
        `SMS sent to ${notification.recipient}, messageId: ${message.sid}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${notification.recipient}`,
        error.stack,
      );
      throw error;
    }
  }

  isAvailable(): boolean {
    return !!this.twilioClient;
  }
}
