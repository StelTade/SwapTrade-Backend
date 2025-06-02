import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${resetToken}`;
    const expirationTime =
      this.configService.get('PASSWORD_RESET_EXPIRATION_HOURS') || 1;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: {
          firstName,
          resetUrl,
          expirationTime,
          supportEmail: this.configService.get('SUPPORT_EMAIL'),
          companyName: this.configService.get('COMPANY_NAME'),
        },
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error.stack,
      );
      throw new Error('Failed to send password reset email');
    }
  }

  async sendPasswordResetConfirmationEmail(
    email: string,
    firstName: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Successfully Reset',
        template: 'password-reset-confirmation',
        context: {
          firstName,
          supportEmail: this.configService.get('SUPPORT_EMAIL'),
          companyName: this.configService.get('COMPANY_NAME'),
        },
      });

      this.logger.log(`Password reset confirmation email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send confirmation email to ${email}`,
        error.stack,
      );
      // Don't throw error here as it's not critical
    }
  }
}
