import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  async sendEmail(notification: Notification): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM', 'notifications@swaptrade.com'),
        to: notification.recipient,
        subject: notification.subject,
        html: notification.body,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${notification.recipient}, messageId: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${notification.recipient}`, error.stack);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed', error.stack);
      return false;
    }
  }
}