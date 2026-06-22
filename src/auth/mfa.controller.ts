import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { MFAService } from './mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './guards/jwt-auth.guard';

@ApiTags('identity/auth/mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('identity/auth/mfa')
export class MFAController {
  constructor(private readonly mfaService: MFAService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Generate TOTP secret and QR code for MFA setup' })
  @ApiResponse({ status: 201, description: 'TOTP secret generated' })
  async setup(@CurrentUser() user: JwtPayload) {
    return this.mfaService.generateSecret(user.sub);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable MFA after verifying TOTP token' })
  @ApiResponse({ status: 200, description: 'MFA enabled with recovery codes' })
  async enable(
    @CurrentUser() user: JwtPayload,
    @Body() body: { secret: string; token: string },
  ) {
    return this.mfaService.verifyAndEnable(user.sub, body.secret, body.token);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA (requires current TOTP token)' })
  @ApiResponse({ status: 200, description: 'MFA disabled' })
  async disable(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string },
  ) {
    return this.mfaService.disable(user.sub, body.token);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a TOTP token' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  async verify(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string },
  ) {
    const isValid = await this.mfaService.verifyToken(user.sub, body.token);
    return { success: isValid };
  }
}