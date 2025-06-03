import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PasswordResetService } from './password-reset.service';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  ValidateTokenDto,
} from './dto';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('request')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<{ message: string }> {
    await this.passwordResetService.requestPasswordReset(
      requestPasswordResetDto.email,
      ipAddress,
      userAgent || 'Unknown',
    );

    return {
      message:
        'If the email exists in our system, you will receive a password reset link shortly.',
    };
  }

  @Post('reset')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Ip() ipAddress: string,
  ): Promise<{ message: string }> {
    await this.passwordResetService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
      ipAddress,
    );

    return {
      message: 'Password has been successfully reset.',
    };
  }

  @Get('validate-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async validateToken(
    @Query() validateTokenDto: ValidateTokenDto,
  ): Promise<{ valid: boolean }> {
    const isValid = await this.passwordResetService.validateToken(
      validateTokenDto.token,
    );

    return { valid: isValid };
  }
}
