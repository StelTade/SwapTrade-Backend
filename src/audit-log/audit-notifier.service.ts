import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuditNotifierService {
  private readonly logger = new Logger(AuditNotifierService.name);

  async notifyAdmins(payload: {
    title: string;
    body: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    this.logger.warn(`[ADMIN ALERT] ${payload.title}: ${payload.body}`);
    // plug in email/Slack/webhook here
  }
}
