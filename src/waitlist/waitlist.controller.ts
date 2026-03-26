import { Controller, Post, Body, BadRequestException } from '@nestjs/common';

@Controller('api/waitlist')
export class WaitlistController {
  
  @Post('signup')
  async signup(@Body() dto: { email: string; name?: string; referral_code?: string }) {
    if (!dto.email || !dto.email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    // TODO: DB Insert and token generation
    return { success: true, message: 'Signup successful, verification email sent.' };
  }

  @Post('verify')
  async verify(@Body() dto: { token: string }) {
    if (!dto.token) {
      throw new BadRequestException('Token is required');
    }
    // TODO: Verify token and update status to verified
    return { success: true, message: 'Email verified successfully.' };
  }
}
