import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { WaitlistSignupDto } from './dto/waitlist-signup.dto';
import { WaitlistVerifyDto } from './dto/waitlist-verify.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('waitlist')
@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register for the waitlist', description: 'Register a new user on the waitlist and receive a verification email.' })
  @ApiResponse({ status: 201, description: 'Registration successful. Verification email sent.', schema: { example: { message: 'Registration successful. Please check your email to verify your account.' } } })
  @ApiErrorResponses()
  async signup(@Body() dto: WaitlistSignupDto) {
    return this.waitlistService.signup(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email', description: 'Verify a waitlist user email using the token sent to their email address.' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.', schema: { example: { message: 'Email verified successfully. You are now on the waitlist!' } } })
  @ApiErrorResponses()
  async verify(@Body() dto: WaitlistVerifyDto) {
    return this.waitlistService.verify(dto);
  }
}
