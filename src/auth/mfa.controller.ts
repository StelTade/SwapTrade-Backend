import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { MFAService } from './mfa.service';

@Controller('auth/mfa')
export class MFAController {
  constructor(private readonly mfaService: MFAService) {}

  @Post('setup')
  async setup(@Req() req: any) {
    // Assuming user is already authenticated for setup
    return this.mfaService.generateSecret(req.user);
  }

  @Post('enable')
  async enable(
    @Req() req: any,
    @Body() body: { secret: string; token: string },
  ) {
    return this.mfaService.verifyAndEnable(
      req.user.id,
      body.secret,
      body.token,
    );
  }

  @Post('disable')
  async disable(@Req() req: any, @Body() body: { token: string }) {
    return this.mfaService.disable(req.user.id, body.token);
  }

  @Post('verify')
  async verify(@Req() req: any, @Body() body: { token: string }) {
    const isValid = await this.mfaService.verifyToken(req.user.id, body.token);
    return { success: isValid };
  }
}
