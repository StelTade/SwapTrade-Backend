  @Post('sessions/list')
  @ApiOperation({ summary: 'List user sessions', description: 'List all active sessions/devices for the user.' })
  listSessions(@Req() req) {
    return this.authService.listSessions(req.user);
  }

  @Post('sessions/revoke')
  @ApiOperation({ summary: 'Revoke a session', description: 'Revoke a specific session/device.' })
  revokeSession(@Body('sessionId') sessionId: number, @Req() req) {
    return this.authService.revokeSession(req.user, sessionId);
  }

import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TwoFADto, Enable2FADto } from './dto/2fa.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuthErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and return JWT token', description: 'Requires email and password. If 2FA is enabled, requires 2FA code.' })
  @ApiResponse({ status: 201, description: 'Login successful', schema: { example: { accessToken: 'jwt-token' } } })
  @ApiAuthErrorResponses()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('2fa/setup')
  @ApiOperation({ summary: 'Setup 2FA (TOTP or SMS)', description: 'Initiate 2FA setup for the user.' })
  setup2FA(@Body() dto: Enable2FADto, @Req() req) {
    return this.authService.setup2FA(dto, req.user);
  }

  @Post('2fa/verify')
  @ApiOperation({ summary: 'Verify 2FA code', description: 'Verify a TOTP or SMS code for 2FA.' })
  verify2FA(@Body() dto: TwoFADto, @Req() req) {
    return this.authService.verify2FA(dto, req.user);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'Enable 2FA for user', description: 'Enable 2FA after successful verification.' })
  enable2FA(@Req() req) {
    return this.authService.enable2FA(req.user);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA for user', description: 'Disable 2FA for the user.' })
  disable2FA(@Req() req) {
    return this.authService.disable2FA(req.user);
  }


  @Post('register')
  @ApiOperation({ summary: 'Register a new user', description: 'Creates a new user account. Rate limited to prevent abuse.' })
  @ApiResponse({ status: 201, description: 'Registration successful', schema: { example: { id: 1, email: 'user@example.com' } } })
  @ApiAuthErrorResponses()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
