import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import * as moment from 'moment';

@Injectable()
export class PasswordResetRateLimitGuard implements CanActivate {
  constructor(
    @InjectRepository(PasswordResetToken)
    private passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ipAddress = request.ip;

    // Check IP-based rate limiting (10 requests per hour per IP)
    const oneHourAgo = moment().subtract(1, 'hour').toDate();

    const requestCount = await this.passwordResetTokenRepository.count({
      where: {
        ipAddress,
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (requestCount >= 10) {
      throw new HttpException(
        'Too many password reset requests from this IP. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
