import { Injectable, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationEventType } from '../../common/enums/notification-event-type.enum';
import { NotificationChannel } from '../../common/enums/notification-channel.enum';

interface RenderedTemplate {
  subject: string;
  body: string;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly i18n: I18nService) {}

  async renderTemplate(
    eventType: NotificationEventType,
    channel: NotificationChannel,
    data: Record<string, any>,
    language: string = 'en',
  ): Promise<RenderedTemplate> {
    const translationKey = `notifications.${eventType.toLowerCase()}.${channel.toLowerCase()}`;

    try {
      const subject = await this.i18n.translate(`${translationKey}.subject`, {
        lang: language,
        args: data,
      });

      const body = await this.i18n.translate(`${translationKey}.body`, {
        lang: language,
        args: data,
      });

      return { subject, body };
    } catch (error) {
      this.logger.error(
        `Failed to render template for ${eventType} in ${language}`,
        error.stack,
      );
      // Fallback to English
      const fallbackSubject = await this.i18n.translate(
        `${translationKey}.subject`,
        {
          lang: 'en',
          args: data,
        },
      );
      const fallbackBody = await this.i18n.translate(`${translationKey}.body`, {
        lang: 'en',
        args: data,
      });
      return { subject: fallbackSubject, body: fallbackBody };
    }
  }

  getSupportedLanguages(): string[] {
    return ['en', 'es', 'zh'];
  }
}
