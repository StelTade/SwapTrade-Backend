import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { Auth } from './entities/auth.entity';

@Injectable()
export class MFAService {
  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
  ) {}

  async generateSecret(authId: string) {
    const auth = await this.authRepository.findOne({ where: { id: authId } });
    if (!auth) throw new NotFoundException('Auth record not found');

    const secret = speakeasy.generateSecret({
      name: `SwapTrade (${auth.email})`,
      length: 20,
    });

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Temporarily save secret; it becomes permanent only after verify + enable
    auth.totpSecret = secret.base32;
    await this.authRepository.save(auth);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    };
  }

  async verifyAndEnable(authId: string, secret: string, token: string) {
    const isValid = speakeasy.totp.verify({
      token,
      secret,
      encoding: 'base32',
      window: 1,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP token');
    }

    const recoveryCodes = Array.from({ length: 8 }, () =>
      uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase(),
    );

    await this.authRepository.update(authId, {
      totpSecret: secret,
      is2FAEnabled: true,
    });

    return { recoveryCodes };
  }

  async verifyToken(authId: string, token: string): Promise<boolean> {
    const auth = await this.authRepository
      .createQueryBuilder('auth')
      .addSelect('auth.totpSecret')
      .where('auth.id = :id', { id: authId })
      .getOne();

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      return true; // MFA not enabled — pass through
    }

    return speakeasy.totp.verify({
      token,
      secret: auth.totpSecret,
      encoding: 'base32',
      window: 1,
    });
  }

  async disable(authId: string, token: string) {
    const auth = await this.authRepository
      .createQueryBuilder('auth')
      .addSelect('auth.totpSecret')
      .where('auth.id = :id', { id: authId })
      .getOne();

    if (!auth || !auth.is2FAEnabled || !auth.totpSecret) {
      throw new BadRequestException('MFA is not enabled');
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
      totpSecret: undefined,
    });

    return { message: 'MFA disabled successfully' };
  }
}
