import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import { Auth, AccountStatus } from './entities/auth.entity';
import { Session } from './entities/session.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/password-reset.dto';
import { Enable2FADto, TwoFADto, Verify2FASetupDto } from './dto/2fa.dto';
import { JwtPayload } from './guards/jwt-auth.guard';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

// ─── Event Constants ──────────────────────────────────────────────────────────
export const AUTH_EVENTS = {
  USER_REGISTERED: 'identity.user.registered',
  USER_LOGGED_IN: 'identity.user.loggedIn',
  USER_LOGGED_OUT: 'identity.user.loggedOut',
  PASSWORD_CHANGED: 'identity.password.changed',
  PASSWORD_RESET_REQUESTED: 'identity.password.resetRequested',
  ACCOUNT_LOCKED: 'identity.account.locked',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Auth)
    private readonly authRepo: Repository<Auth>,

    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Registration ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto, correlationId?: string) {
    const existing = await this.authRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const usernameExists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (usernameExists) {
      throw new ConflictException('Email already in use');
    }

    const bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

    const activationToken = uuidv4();
    const activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    // Create auth credential
    const auth = this.authRepo.create({
      email: dto.email,
      staffId: dto.email, // backward-compat
      passwordHash,
      status: AccountStatus.INACTIVE,
      activationToken,
      activationTokenExpiry,
      correlationId,
    });
    await this.authRepo.save(auth);

    // Create user profile
    const user = this.userRepo.create({
      authId: auth.id,
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.USER,
      roles: [UserRole.USER],
      status: AccountStatus.INACTIVE,
    });
    await this.userRepo.save(user);

    this.eventEmitter.emit(AUTH_EVENTS.USER_REGISTERED, {
      authId: auth.id,
      userId: user.id,
      email: auth.email,
      correlationId,
    });

    this.logger.log(`User registered: ${auth.email}`);

    return {
      message: 'Registration successful. Please check your email to activate your account.',
      userId: user.id,
      // NOTE: In production, remove activationToken from response and send via email only
      activationToken,
    };
  }

  // ─── Account Activation ─────────────────────────────────────────────────────

  async activateAccount(token: string) {
    const auth = await this.authRepo.findOne({
      where: { activationToken: token },
      select: [
        'id', 'email', 'status', 'activationToken',
        'activationTokenExpiry', 'staffId',
      ],
    });

    if (!auth || !auth.activationToken) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    if (auth.activationTokenExpiry && auth.activationTokenExpiry < new Date()) {
      throw new BadRequestException('Activation token has expired');
    }

    auth.status = AccountStatus.ACTIVE;
    auth.activationToken = undefined;
    auth.activationTokenExpiry = undefined;
    await this.authRepo.save(auth);

    // Activate user profile too
    await this.userRepo.update(
      { authId: auth.id },
      { status: AccountStatus.ACTIVE },
    );

    return { message: 'Account activated successfully' };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.passwordHash')
      .addSelect('auth.totpSecret')
      .addSelect('auth.smsCode')
      .where('auth.email = :email', { email: dto.email })
      .getOne();

    if (!auth) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Account status checks
    if (auth.status === AccountStatus.INACTIVE) {
      throw new UnauthorizedException('Account not yet activated. Please check your email.');
    }
    if (auth.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Account has been suspended. Please contact support.');
    }
    if (auth.status === AccountStatus.LOCKED) {
      const lockoutDuration = this.configService.get<number>('AUTH_LOCKOUT_DURATION', 900000);
      if (auth.lockedUntil && auth.lockedUntil > new Date()) {
        const retryAfterSeconds = Math.ceil((auth.lockedUntil.getTime() - Date.now()) / 1000);
        throw new ForbiddenException(
          `Account is temporarily locked. Try again in ${retryAfterSeconds} seconds.`,
        );
      }
      // Lock period has expired — reset
      auth.status = AccountStatus.ACTIVE;
      auth.failedLoginAttempts = 0;
      auth.lockedUntil = undefined;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, auth.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(auth);
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA check
    if (auth.is2FAEnabled) {
      if (!dto.code) {
        throw new UnauthorizedException('2FA code required');
      }
      const twoFaValid = await this.verify2FACode(auth, dto.code);
      if (!twoFaValid) {
        await this.handleFailedLogin(auth);
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Reset failed attempts on successful login
    auth.failedLoginAttempts = 0;
    auth.lastLoginAt = new Date();
    auth.lastLoginIp = ipAddress;
    await this.authRepo.save(auth);

    // Get the linked user profile
    const user = await this.userRepo.findOne({ where: { authId: auth.id } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const tokens = await this.generateTokenPair(auth, user);

    // Persist session
    const sessionToken = tokens.refreshToken;
    const refreshTokenHash = this.hashToken(sessionToken);
    const session = this.sessionRepo.create({
      authId: auth.id,
      sessionToken: uuidv4(), // opaque session ID stored in DB
      deviceInfo: dto.deviceInfo,
      ipAddress,
      userAgent,
      expiresAt: new Date(
        Date.now() + this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800) * 1000,
      ),
    });
    await this.sessionRepo.save(session);

    // Store hashed refresh token
    const existingHashes = (auth.refreshTokenHashes ?? []).filter(Boolean);
    await this.authRepo
      .createQueryBuilder()
      .update(Auth)
      .set({
        refreshTokenHashes: [...existingHashes, refreshTokenHash].slice(-10), // keep last 10
      })
      .where('id = :id', { id: auth.id })
      .execute();

    this.eventEmitter.emit(AUTH_EVENTS.USER_LOGGED_IN, {
      authId: auth.id,
      userId: user.id,
      email: auth.email,
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<number>('JWT_EXPIRES_IN', 3600),
      user: this.sanitizeUser(user),
    };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(authId: string, refreshToken?: string) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.authRepo
        .createQueryBuilder()
        .update(Auth)
        .set({
          refreshTokenHashes: () =>
            `array_remove("refreshTokenHashes", '${hash}')`,
        })
        .where('id = :id', { id: authId })
        .execute();
    }

    // Revoke all active sessions for security — or only the current session
    await this.sessionRepo.update({ authId, revoked: false }, { revoked: true });

    const auth = await this.authRepo.findOne({ where: { id: authId } });
    if (auth) {
      const user = await this.userRepo.findOne({ where: { authId: auth.id } });
      this.eventEmitter.emit(AUTH_EVENTS.USER_LOGGED_OUT, {
        authId: auth.id,
        userId: user?.id,
        email: auth.email,
      });
    }

    return { message: 'Logged out successfully' };
  }

  // ─── Token Refresh ──────────────────────────────────────────────────────────

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.refreshTokenHashes')
      .where('auth.id = :id', { id: payload.sub })
      .getOne();

    if (!auth) {
      throw new UnauthorizedException('Auth record not found');
    }

    // Verify the token hash is in the stored list (token rotation validation)
    const hash = this.hashToken(dto.refreshToken);
    const storedHashes = auth.refreshTokenHashes ?? [];
    if (!storedHashes.includes(hash)) {
      // Possible token reuse — revoke all sessions
      await this.sessionRepo.update({ authId: auth.id }, { revoked: true });
      await this.authRepo.update({ id: auth.id }, { refreshTokenHashes: [] });
      throw new UnauthorizedException('Refresh token reuse detected. All sessions invalidated.');
    }

    const user = await this.userRepo.findOne({ where: { authId: auth.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tokens = await this.generateTokenPair(auth, user);

    // Token rotation: remove old hash, add new one
    const newHash = this.hashToken(tokens.refreshToken);
    const updatedHashes = storedHashes.filter((h) => h !== hash);
    updatedHashes.push(newHash);
    await this.authRepo.update({ id: auth.id }, { refreshTokenHashes: updatedHashes.slice(-10) });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<number>('JWT_EXPIRES_IN', 3600),
    };
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const auth = await this.authRepo.findOne({ where: { email: dto.email } });

    // Always return 200 to prevent email enumeration
    if (!auth) {
      return {
        message: 'If an account with that email exists, a reset link has been sent.',
      };
    }

    const token = uuidv4();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    auth.passwordResetToken = token;
    auth.passwordResetExpiry = expiry;
    await this.authRepo.save(auth);

    this.eventEmitter.emit(AUTH_EVENTS.PASSWORD_RESET_REQUESTED, {
      authId: auth.id,
      email: auth.email,
      resetToken: token, // consumed by email service listener
    });

    this.logger.log(`Password reset requested for: ${auth.email}`);

    return {
      message: 'If an account with that email exists, a reset link has been sent.',
      // NOTE: In production remove this and send via email only
      resetToken: token,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.passwordResetToken')
      .addSelect('auth.passwordResetExpiry')
      .where('auth.passwordResetToken = :token', { token: dto.token })
      .getOne();

    if (
      !auth ||
      !auth.passwordResetToken ||
      (auth.passwordResetExpiry && auth.passwordResetExpiry < new Date())
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    auth.passwordHash = await bcrypt.hash(dto.newPassword, bcryptRounds);
    auth.passwordResetToken = undefined;
    auth.passwordResetExpiry = undefined;
    // Invalidate all sessions on password reset
    auth.refreshTokenHashes = [];
    await this.authRepo.save(auth);

    await this.sessionRepo.update({ authId: auth.id }, { revoked: true });

    this.eventEmitter.emit(AUTH_EVENTS.PASSWORD_CHANGED, {
      authId: auth.id,
      email: auth.email,
    });

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(authId: string, dto: ChangePasswordDto) {
    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.passwordHash')
      .where('auth.id = :id', { id: authId })
      .getOne();

    if (!auth) {
      throw new NotFoundException('Auth record not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, auth.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const bcryptRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12);
    auth.passwordHash = await bcrypt.hash(dto.newPassword, bcryptRounds);
    auth.refreshTokenHashes = [];
    await this.authRepo.save(auth);

    // Revoke all sessions after password change
    await this.sessionRepo.update({ authId: auth.id }, { revoked: true });

    this.eventEmitter.emit(AUTH_EVENTS.PASSWORD_CHANGED, {
      authId: auth.id,
      email: auth.email,
    });

    return { message: 'Password changed successfully' };
  }

  // ─── Session Management ──────────────────────────────────────────────────────

  async listSessions(authId: string) {
    const sessions = await this.sessionRepo.find({
      where: { authId, revoked: false },
      order: { lastActive: 'DESC' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(authId: string, sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, authId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.revoked = true;
    await this.sessionRepo.save(session);

    return { message: 'Session revoked successfully' };
  }

  async revokeAllSessions(authId: string) {
    await this.sessionRepo.update({ authId, revoked: false }, { revoked: true });
    await this.authRepo.update({ id: authId }, { refreshTokenHashes: [] });

    return { message: 'All sessions revoked successfully' };
  }

  // ─── 2FA ────────────────────────────────────────────────────────────────────

  async setup2FA(authId: string, dto: Enable2FADto) {
    const auth = await this.authRepo.findOne({ where: { id: authId } });
    if (!auth) throw new UnauthorizedException('Auth record not found');

    if (dto.method === 'totp') {
      const secret = speakeasy.generateSecret({
        name: `SwapTrade (${auth.email})`,
        length: 20,
      });
      // Temporarily store secret (not enabled until verified)
      auth.totpSecret = secret.base32;
      await this.authRepo.save(auth);

      const qrcode = await import('qrcode');
      const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url!);

      return {
        method: 'totp',
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl,
      };
    }

    if (dto.method === 'sms') {
      if (!dto.phoneNumber) {
        throw new BadRequestException('Phone number is required for SMS 2FA');
      }
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      auth.smsCode = code;
      auth.smsCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      auth.phoneNumber = dto.phoneNumber;
      await this.authRepo.save(auth);

      // TODO: send via SMS provider
      this.logger.log(`SMS code generated for ${auth.email}: ${code}`);

      return { method: 'sms', message: 'SMS code sent', phoneNumber: dto.phoneNumber };
    }

    throw new BadRequestException('Unsupported 2FA method');
  }

  async verify2FASetup(authId: string, dto: Verify2FASetupDto) {
    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.totpSecret')
      .where('auth.id = :id', { id: authId })
      .getOne();

    if (!auth) throw new NotFoundException('Auth record not found');

    const isValid = speakeasy.totp.verify({
      token: dto.token,
      secret: dto.secret,
      encoding: 'base32',
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token — verify setup failed');
    }

    // Generate recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () =>
      uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase(),
    );

    auth.totpSecret = dto.secret;
    auth.is2FAEnabled = true;
    await this.authRepo.save(auth);

    return { message: '2FA enabled successfully', recoveryCodes };
  }

  async disable2FA(authId: string, dto: TwoFADto) {
    const auth = await this.authRepo
      .createQueryBuilder('auth')
      .addSelect('auth.totpSecret')
      .addSelect('auth.smsCode')
      .where('auth.id = :id', { id: authId })
      .getOne();

    if (!auth) throw new NotFoundException('Auth record not found');
    if (!auth.is2FAEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const valid = await this.verify2FACode(auth, dto.code);
    if (!valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    auth.is2FAEnabled = false;
    auth.totpSecret = undefined;
    auth.smsCode = undefined;
    auth.smsCodeExpiry = undefined;
    await this.authRepo.save(auth);

    return { message: '2FA disabled successfully' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async handleFailedLogin(auth: Auth) {
    const maxAttempts = this.configService.get<number>('AUTH_MAX_LOGIN_ATTEMPTS', 5);
    const lockoutDuration = this.configService.get<number>('AUTH_LOCKOUT_DURATION', 900000);

    auth.failedLoginAttempts = (auth.failedLoginAttempts ?? 0) + 1;

    if (auth.failedLoginAttempts >= maxAttempts) {
      auth.status = AccountStatus.LOCKED;
      auth.lockedUntil = new Date(Date.now() + lockoutDuration);

      this.eventEmitter.emit(AUTH_EVENTS.ACCOUNT_LOCKED, {
        authId: auth.id,
        email: auth.email,
        lockedUntil: auth.lockedUntil,
      });

      this.logger.warn(`Account locked: ${auth.email}`);
    }

    await this.authRepo.save(auth);
  }

  private async verify2FACode(auth: Auth, code: string): Promise<boolean> {
    if (auth.totpSecret) {
      return speakeasy.totp.verify({
        token: code,
        secret: auth.totpSecret,
        encoding: 'base32',
        window: 1,
      });
    }

    if (auth.smsCode && auth.smsCodeExpiry && auth.smsCodeExpiry > new Date()) {
      return code === auth.smsCode;
    }

    return false;
  }

  private async generateTokenPair(auth: Auth, user: User) {
    const sessionId = uuidv4();

    const accessPayload: JwtPayload = {
      sub: auth.id,
      userId: user.id,
      email: auth.email,
      role: user.role,
      roles: user.roles,
      sessionId,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: auth.id,
      userId: user.id,
      email: auth.email,
      role: user.role,
      roles: user.roles,
      sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<number>('JWT_EXPIRES_IN', 3600),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      roles: user.roles,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}
