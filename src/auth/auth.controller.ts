import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/password-reset.dto';
import { Enable2FADto, TwoFADto, Verify2FASetupDto } from './dto/2fa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { JwtPayload } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ApiAuthErrorResponses } from '../common/decorators/swagger-error-responses.decorator';
import { Roles } from '../identity/roles/decorators/roles.decorator';
import { UserRole } from '../identity/roles/enums/user-role.enum';

@ApiTags('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Registration & Activation ─────────────────────────────────────────────

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiAuthErrorResponses()
  signup(@Body() dto: RegisterDto, @Req() req: Request) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string);
    return this.authService.register(dto, correlationId);
  }

  @Public()
  @Get('activate')
  @ApiOperation({ summary: 'Activate account via email token' })
  @ApiResponse({ status: 200, description: 'Account activated' })
  activate(@Query('token') token: string) {
    return this.authService.activateAccount(token);
  }

  // ─── Login / Logout ────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT access + refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'eyJ...',
        refreshToken: 'eyJ...',
        tokenType: 'Bearer',
        expiresIn: 3600,
      },
    },
  })
  @ApiAuthErrorResponses()
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.authService.login(dto, ip, ua);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke current session' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { refreshToken?: string },
  ) {
    return this.authService.logout(user.sub, body.refreshToken);
  }

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and obtain new access + refresh tokens',
  })
  @ApiResponse({ status: 200, description: 'Tokens refreshed' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  // ─── Password Reset ────────────────────────────────────────────────────────

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Reset link sent (if email exists)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('password/change')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  // ─── Session Management ────────────────────────────────────────────────────

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions for the current user' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(user.sub, sessionId);
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions (sign out everywhere)' })
  @ApiResponse({ status: 200, description: 'All sessions revoked' })
  revokeAllSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.revokeAllSessions(user.sub);
  }

  // ─── 2FA ───────────────────────────────────────────────────────────────────

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate 2FA setup (TOTP or SMS)' })
  @ApiResponse({ status: 201, description: '2FA setup initiated' })
  setup2FA(@CurrentUser() user: JwtPayload, @Body() dto: Enable2FADto) {
    return this.authService.setup2FA(user.sub, dto);
  }

  @Post('2fa/verify-setup')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify and activate 2FA after setup' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  verify2FASetup(
    @CurrentUser() user: JwtPayload,
    @Body() dto: Verify2FASetupDto,
  ) {
    return this.authService.verify2FASetup(user.sub, dto);
  }

  @Post('2fa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA (requires current 2FA code)' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  disable2FA(@CurrentUser() user: JwtPayload, @Body() dto: TwoFADto) {
    return this.authService.disable2FA(user.sub, dto);
  }

  // ─── Admin Endpoints ───────────────────────────────────────────────────────

  @Get('admin/users')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, description: 'List of all users' })
  listAllUsers(@CurrentUser() user: JwtPayload) {
    return this.authService.listAllUsers();
  }

  @Post('admin/users/:userId/roles')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign roles to a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  assignUserRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: { roles: UserRole[] },
  ) {
    return this.authService.assignUserRoles(userId, body.roles);
  }

  @Delete('admin/users/:userId/roles')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke roles from a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Roles revoked successfully' })
  revokeUserRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: { roles: UserRole[] },
  ) {
    return this.authService.revokeUserRoles(userId, body.roles);
  }
}
