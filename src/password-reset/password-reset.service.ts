import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PasswordResetToken } from './entities/password-reset-token.entity';
// import { User } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as moment from 'moment';
import { UserService } from 'src/user/provider/user-services.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
    private readonly usersService: UserService,
    private readonly configService: ConfigService,
  ) {}

  async requestPasswordReset(
    email: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    // Find user by email
    const user = await this.usersService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      this.logger.warn(
        `Password reset requested for non-existent email: ${email}`,
      );
      return;
    }

    // Check for recent reset requests (rate limiting)
    await this.checkRecentResetRequests(user.id);

    // Invalidate existing tokens for this user
    await this.invalidateExistingTokens(user.id);

    // Generate secure token
    const token = await this.generateSecureToken();
    const tokenHash = await this.hashToken(token);

    // Calculate expiration time
    const expirationHours = parseInt(
      this.configService.get('PASSWORD_RESET_EXPIRATION_HOURS') || '1',
    );
    const expiresAt = moment().add(expirationHours, 'hours').toDate();

    // Save token to database
    const resetToken = this.passwordResetTokenRepository.create({
      userId: user.id,
      token,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    await this.passwordResetTokenRepository.save(resetToken);

    // Send email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      token,
    );

    this.logger.log(`Password reset token generated for user ${user.id}`);
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<void> {
    // Find and validate token
    const resetToken = await this.findValidToken(token);

    // Update user password
    await this.usersService.updatePassword(resetToken.userId, newPassword);

    // Mark token as used
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    // Get user for confirmation email
    const user = await this.usersService.findUserById(resetToken.userId);

    // Send confirmation email
    await this.emailService.sendPasswordResetConfirmationEmail(
      user.email,
      user.firstname,
    );

    // Invalidate all other tokens for this user
    await this.invalidateExistingTokens(resetToken.userId, resetToken.id);

    this.logger.log(
      `Password successfully reset for user ${resetToken.userId}`,
    );
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await this.findValidToken(token);
      return true;
    } catch {
      return false;
    }
  }

  private async findValidToken(token: string): Promise<PasswordResetToken> {
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    // Verify token hash for additional security
    const isValidHash = await bcrypt.compare(token, resetToken.tokenHash);
    if (!isValidHash) {
      throw new UnauthorizedException('Invalid token');
    }

    return resetToken;
  }

  private async generateSecureToken(): Promise<string> {
    // Generate cryptographically secure random token
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString(36);
    const randomString = randomBytes.toString('hex');

    return `${timestamp}_${randomString}`;
  }

  private async hashToken(token: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(token, saltRounds);
  }

  private async checkRecentResetRequests(userId: number): Promise<void> {
    const rateLimitMinutes = parseInt(
      this.configService.get('PASSWORD_RESET_RATE_LIMIT_MINUTES') || '15',
    );

    const cutoffTime = moment().subtract(rateLimitMinutes, 'minutes').toDate();

    const recentRequest = await this.passwordResetTokenRepository.findOne({
      where: {
        userId,
        createdAt: LessThan(cutoffTime),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentRequest) {
      throw new BadRequestException(
        `Please wait ${rateLimitMinutes} minutes before requesting another password reset`,
      );
    }
  }

  private async invalidateExistingTokens(
    userId: number,
    excludeTokenId?: number,
  ): Promise<void> {
    const query = this.passwordResetTokenRepository
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ usedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('usedAt IS NULL');

    if (excludeTokenId) {
      query.andWhere('id != :excludeTokenId', { excludeTokenId });
    }

    await query.execute();
  }

  // Cleanup expired tokens (should be run as a cron job)
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.passwordResetTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    this.logger.log(
      `Cleaned up ${result.affected} expired password reset tokens`,
    );
  }
}
