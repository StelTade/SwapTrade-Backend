import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { Auth } from './entities/auth.entity';

@Injectable()
export class MFAService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
  ) {}

  async generateSecret(auth: Auth) {
    const secret = speakeasy.generateSecret({ length: 20 });
    const otpauthUrl = secret.otpauth_url;
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
    };
  }

  async verifyAndEnable(authId: number, secret: string, token: string) {
    const isValid = speakeasy.totp.verify({
      token,
      secret,
      encoding: 'base32',
    });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    const recoveryCodes = Array.from({ length: 8 }).map(() =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    await this.authRepository.update(authId, {
      totpSecret: secret,
      is2FAEnabled: true,
    });

    return { recoveryCodes };
  }

  async verifyToken(authId: number, token: string): Promise<boolean> {
    const auth = await this.authRepository.findOne({
      where: { id: authId },
      select: ['id', 'totpSecret', 'is2FAEnabled'],
    });

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      return true; // MFA not enabled
    }

    return speakeasy.totp.verify({
      token,
      secret: auth.totpSecret,
      encoding: 'base32',
    });
  }

  async disable(authId: number, token: string) {
    const auth = await this.authRepository.findOne({
      where: { id: authId },
      select: ['id', 'totpSecret', 'is2FAEnabled'],
    });

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      throw new BadRequestException('MFA not enabled');
    }

    const isValid = speakeasy.totp.verify({
      token,
      secret: auth.totpSecret,
      encoding: 'base32',
    });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    await this.authRepository.update(authId, {
      is2FAEnabled: false,
      totpSecret: '',
    });
  }
}
