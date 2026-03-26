import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import {
  SignupWaitlistDto,
  VerifyWaitlistDto,
  WaitlistUserResponseDto,
} from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('waitlist')
@Controller('api/waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sign up for waitlist',
    description:
      'Register a new user on the waitlist and send verification email',
  })
  @ApiBody({ type: SignupWaitlistDto })
  @ApiResponse({
    status: 201,
    description: 'Signup successful, verification email sent',
  })
  @ApiErrorResponses()
  async signup(@Body() dto: SignupWaitlistDto) {
    const result = await this.waitlistService.signup(dto);
    return {
      user: result.user,
      message: result.message,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email',
    description: 'Verify user email with the token sent to their email',
  })
  @ApiBody({ type: VerifyWaitlistDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiErrorResponses()
  async verify(@Body() dto: VerifyWaitlistDto) {
    const result = await this.waitlistService.verify(dto);
    return {
      user: result.user,
      message: result.message,
    };
  }

  @Get('user/:id')
  @ApiOperation({
    summary: 'Get waitlist user by ID',
    description: 'Retrieve waitlist user details by user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: WaitlistUserResponseDto,
  })
  @ApiErrorResponses()
  async getUser(@Param('id') id: string) {
    return this.waitlistService.getUserById(id);
  }
}
