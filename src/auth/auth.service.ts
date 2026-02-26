import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { Auth } from './entities/auth.entity';
import { Session } from './entities/session.entity';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { TwoFADto, Enable2FADto } from './dto/2fa.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepo: Repository<Auth>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async login(body: LoginDto & { code?: string, deviceInfo?: string }) {
    const user = await this.authRepo.findOne({
      where: { staffId: body.staffId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.is2FAEnabled) {
      if (!body.code) {
        throw new UnauthorizedException('2FA code required');
      }
      // Check TOTP
      if (user.totpSecret) {
        const verified = speakeasy.totp.verify({
          secret: user.totpSecret,
          encoding: 'base32',
          token: body.code,
        });
        if (!verified) {
          throw new UnauthorizedException('Invalid 2FA code');
        }
      } else if (user.smsCode && user.smsCodeExpiry && user.smsCodeExpiry > new Date()) {
        if (body.code !== user.smsCode) {
          throw new UnauthorizedException('Invalid SMS code');
        }
      } else {
        throw new UnauthorizedException('2FA not properly configured');
      }
    }
    // Create session
    const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const session = this.sessionRepo.create({
      user,
      deviceInfo: body.deviceInfo || 'unknown',
      sessionToken,
    });
    await this.sessionRepo.save(session);
    return { message: 'Logged in', sessionToken };
  }

  async listSessions(user: any) {
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    const sessions = await this.sessionRepo.find({ where: { user: auth }, order: { lastActive: 'DESC' } });
    return sessions.map(s => ({ id: s.id, deviceInfo: s.deviceInfo, createdAt: s.createdAt, lastActive: s.lastActive, revoked: s.revoked }));
  }

  async revokeSession(user: any, sessionId: number) {
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, user: auth } });
    if (!session) throw new BadRequestException('Session not found');
    session.revoked = true;
    await this.sessionRepo.save(session);
    return { revoked: true };
  }

  async setup2FA(dto: Enable2FADto, user: any) {
    // Find user
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    if (dto.method === 'totp') {
      const secret = speakeasy.generateSecret();
      auth.totpSecret = secret.base32;
      await this.authRepo.save(auth);
      return { otpauth_url: secret.otpauth_url, secret: secret.base32 };
    } else if (dto.method === 'sms') {
      if (!dto.phoneNumber) throw new BadRequestException('Phone number required');
      // Generate code and set expiry
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      auth.smsCode = code;
      auth.smsCodeExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      auth.phoneNumber = dto.phoneNumber;
      await this.authRepo.save(auth);
      // TODO: Integrate SMS sending provider here
      return { message: 'SMS code sent', phoneNumber: dto.phoneNumber };
    }
    throw new BadRequestException('Invalid 2FA method');
  }

  async verify2FA(dto: TwoFADto, user: any) {
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    if (auth.totpSecret) {
      const verified = speakeasy.totp.verify({
        secret: auth.totpSecret,
        encoding: 'base32',
        token: dto.code,
      });
      if (!verified) throw new UnauthorizedException('Invalid TOTP code');
      return { valid: true };
    } else if (auth.smsCode && auth.smsCodeExpiry && auth.smsCodeExpiry > new Date()) {
      if (dto.code !== auth.smsCode) throw new UnauthorizedException('Invalid SMS code');
      return { valid: true };
    }
    throw new UnauthorizedException('2FA not configured');
  }

  async enable2FA(user: any) {
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    auth.is2FAEnabled = true;
    await this.authRepo.save(auth);
    return { enabled: true };
  }

  async disable2FA(user: any) {
    const auth = await this.authRepo.findOne({ where: { staffId: user.staffId } });
    if (!auth) throw new UnauthorizedException();
    auth.is2FAEnabled = false;
    auth.totpSecret = undefined;
    auth.smsCode = undefined;
    auth.smsCodeExpiry = undefined;
    await this.authRepo.save(auth);
    return { enabled: false };
  }
}
