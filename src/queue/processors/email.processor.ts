// src/queue/processors/email.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../queue.constants';
import { EmailJobData } from '../queue.service';

@Processor(QueueName.EMAILS)
export class EmailJobProcessor {
  private readonly logger = new Logger(EmailJobProcessor.name);

  @Process({ concurrency: 3 })
  async processEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, context } = job.data;

    this.logger.log(
      `Processing email job ${job.id}: ${subject} to ${Array.isArray(to) ? to.join(', ') : to}`,
    );

    try {
      await job.progress(10);

      if (!to || !subject || !template) {
        throw new Error('Invalid email data');
      }

      const emailId = this.generateEmailId(job.data);
      const alreadySent = await this.isEmailSent(emailId);

      if (alreadySent) {
        this.logger.warn(`Email ${emailId} already sent, skipping`);
        await job.progress(100);
        return;
      }

      await job.progress(30);
      const html = await this.renderTemplate(template, context);
      await job.progress(50);
      await this.sendEmail({
        to,
        subject,
        html,
        attachments: job.data.attachments,
      });
      await job.progress(80);
      await this.markEmailAsSent(emailId);
      await job.progress(100);

      this.logger.log(`Email sent successfully: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to process email job ${job.id}:`, error.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<EmailJobData>): void {
    this.logger.debug(`Email job ${job.id} is now active`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<EmailJobData>, result: any): void {
    this.logger.log(`Email job ${job.id} completed: ${job.data.subject}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<EmailJobData>, error: Error): void {
    const attempts = job.opts.attempts || 3;
    this.logger.error(
      `Email job ${job.id} failed. Subject: ${job.data.subject}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );

    if (job.attemptsMade >= attempts) {
      this.logger.error(
        `Email job ${job.id} permanently failed. Subject: ${job.data.subject}`,
      );
      this.notifyAdminOfFailure(job, error);
    }
  }

  private async sendEmail(data: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: any[];
  }): Promise<void> {
    await this.simulateAsyncOperation(500);
    this.logger.debug(
      `Email sent to ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`,
    );
  }

  private async renderTemplate(
    template: string,
    context?: Record<string, any>,
  ): Promise<string> {
    return `
      <html>
        <body>
          <h1>Email Template: ${template}</h1>
          <pre>${JSON.stringify(context, null, 2)}</pre>
        </body>
      </html>
    `;
  }

  private generateEmailId(data: EmailJobData): string {
    const recipients = Array.isArray(data.to)
      ? data.to.sort().join(',')
      : data.to;
    return `${recipients}-${data.subject}-${data.template}`;
  }

  private async isEmailSent(emailId: string): Promise<boolean> {
    return false;
  }

  private async markEmailAsSent(emailId: string): Promise<void> {
    this.logger.debug(`Email marked as sent: ${emailId}`);
  }

  private async notifyAdminOfFailure(
    job: Job<EmailJobData>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `ADMIN ALERT: Email permanently failed\n` +
        `Job ID: ${job.id}\n` +
        `Subject: ${job.data.subject}\n` +
        `Recipients: ${job.data.to}\n` +
        `Error: ${error.message}`,
    );
  }

  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
