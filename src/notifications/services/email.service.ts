import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Notification } from '../entities/notification.entity';
import { CircuitBreakerService, CircuitBreakerOptions } from '../../common/services/circuit-breaker.service';
import { BulkheadService, BulkheadConfig } from '../../common/services/bulkhead.service';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly circuitBreakerName = 'email-smtp';
  private readonly bulkheadName = 'email-bulkhead';

  constructor(
    private configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
  ) {
    this.initializeTransporter();
  }

  onModuleInit() {
    const circuitBreakerOptions: CircuitBreakerOptions = {
      name: this.circuitBreakerName,
      timeout: 15000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10,
      rollingCountTimeout: 60000,
      rollingCountBuckets: 10,
      fallback: async (error: Error, ...args: any[]) => {
        this.logger.error(`Email SMTP circuit breaker fallback triggered: ${error.message}`);
        return false;
      },
    };

    this.circuitBreakerService.register(
      async () => ({ success: true }),
      circuitBreakerOptions,
    );

    const bulkheadConfig: BulkheadConfig = {
      name: this.bulkheadName,
      maxConcurrent: 5,
      maxQueueSize: 20,
      timeout: 30000,
    };

    this.bulkheadService.createBulkhead(bulkheadConfig);
    this.logger.log('Email service initialized with circuit breaker and bulkhead');
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
      return await this.bulkheadService.execute(
        this.bulkheadName,
        async () => {
          return this.circuitBreakerService.execute<boolean>(
            this.circuitBreakerName,
            async () => this.sendEmailInternal(notification),
          );
        },
        'sendEmail',
      );
    } catch (error) {
      this.logger.warn(
        `Email send gracefully degraded for ${notification.recipient}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }

  private async sendEmailInternal(notification: Notification): Promise<boolean> {
    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM', 'notifications@swaptrade.com'),
      to: notification.recipient,
      subject: notification.subject,
      html: notification.body,
    };

    const info = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Email sent to ${notification.recipient}, messageId: ${info.messageId}`);
    return true;
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
