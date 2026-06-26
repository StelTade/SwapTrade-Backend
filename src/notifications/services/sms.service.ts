import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { Notification } from '../entities/notification.entity';
import { CircuitBreakerService, CircuitBreakerOptions } from '../../common/services/circuit-breaker.service';
import { BulkheadService, BulkheadConfig } from '../../common/services/bulkhead.service';

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio;
  private fromNumber: string;
  private readonly circuitBreakerName = 'sms-twilio';
  private readonly bulkheadName = 'sms-bulkhead';

  constructor(
    private configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly bulkheadService: BulkheadService,
  ) {
    this.initializeTwilio();
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
        this.logger.error(`SMS Twilio circuit breaker fallback triggered: ${error.message}`);
        return false;
      },
    };

    this.circuitBreakerService.register(
      async () => ({ success: true }),
      circuitBreakerOptions,
    );

    const bulkheadConfig: BulkheadConfig = {
      name: this.bulkheadName,
      maxConcurrent: 3,
      maxQueueSize: 15,
      timeout: 30000,
    };

    this.bulkheadService.createBulkhead(bulkheadConfig);
    this.logger.log('SMS service initialized with circuit breaker and bulkhead');
  }

  private initializeTwilio() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER')!;

    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized');
    } else {
      this.logger.warn('Twilio credentials not configured, SMS service will be unavailable');
    }
  }

  async sendSms(notification: Notification): Promise<boolean> {
    if (!this.twilioClient) {
      this.logger.warn('Twilio client not initialized — SMS gracefully degraded');
      return false;
    }

    try {
      return await this.bulkheadService.execute(
        this.bulkheadName,
        async () => {
          return this.circuitBreakerService.execute<boolean>(
            this.circuitBreakerName,
            async () => this.sendSmsInternal(notification),
          );
        },
        'sendSms',
      );
    } catch (error) {
      this.logger.warn(
        `SMS send gracefully degraded for ${notification.recipient}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }

  private async sendSmsInternal(notification: Notification): Promise<boolean> {
    const message = await this.twilioClient.messages.create({
      body: notification.body,
      from: this.fromNumber,
      to: notification.recipient,
    });

    this.logger.log(`SMS sent to ${notification.recipient}, messageId: ${message.sid}`);
    return true;
  }

  isAvailable(): boolean {
    return !!this.twilioClient;
  }
}