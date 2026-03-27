import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { UserReferralCode } from '../entities/user-referral-code.entity';
import {
  GenerateReferralCodeResponseDto,
  GetMyCodeResponseDto,
} from '../dto/referral-code.dto';

@Injectable()
export class ReferralCodeService {
  private readonly logger = new Logger(ReferralCodeService.name);
  private readonly CODE_LENGTH_MIN = 8;
  private readonly CODE_LENGTH_MAX = 12;
  private readonly MAX_GENERATION_ATTEMPTS = 10;

  constructor(
    @InjectRepository(UserReferralCode)
    private readonly referralCodeRepo: Repository<UserReferralCode>,
  ) {}

  /**
   * Generate a unique referral code for a user
   * Code format: 8-12 alphanumeric characters (uppercase letters and digits)
   */
  async generateCode(userId: number): Promise<GenerateReferralCodeResponseDto> {
    // Check if user already has a code
    const existingCode = await this.referralCodeRepo.findOne({
      where: { userId },
    });

    if (existingCode) {
      // Reactivate and return existing code
      existingCode.isActive = true;
      await this.referralCodeRepo.save(existingCode);
      return {
        code: existingCode.code,
        qrCodeDataUrl: existingCode.qrCodeDataUrl,
        createdAt: existingCode.createdAt,
      };
    }

    // Generate unique code
    const code = await this.generateUniqueCode();
    const qrCodeDataUrl = this.generateQrCodeDataUrl(code);

    const referralCode = this.referralCodeRepo.create({
      userId,
      code,
      qrCodeDataUrl,
      isActive: true,
    });

    try {
      const savedCode = await this.referralCodeRepo.save(referralCode);
      this.logger.log(`Generated referral code for user ${userId}: ${code}`);

      return {
        code: savedCode.code,
        qrCodeDataUrl: savedCode.qrCodeDataUrl,
        createdAt: savedCode.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to save referral code for user ${userId}`, error.stack);
      throw new InternalServerErrorException('Failed to generate referral code');
    }
  }

  /**
   * Get user's current referral code
   */
  async getMyCode(userId: number): Promise<GetMyCodeResponseDto> {
    const referralCode = await this.referralCodeRepo.findOne({
      where: { userId },
    });

    if (!referralCode) {
      throw new BadRequestException('User does not have a referral code yet');
    }

    return {
      code: referralCode.code,
      qrCodeDataUrl: referralCode.qrCodeDataUrl,
      isActive: referralCode.isActive,
      createdAt: referralCode.createdAt,
      lastUsedAt: referralCode.lastUsedAt,
    };
  }

  /**
   * Generate a unique alphanumeric code
   */
  private async generateUniqueCode(): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars (0, O, I, 1)
    
    for (let attempt = 0; attempt < this.MAX_GENERATION_ATTEMPTS; attempt++) {
      // Random length between MIN and MAX
      const length =
        Math.floor(Math.random() * (this.CODE_LENGTH_MAX - this.CODE_LENGTH_MIN + 1)) +
        this.CODE_LENGTH_MIN;

      // Generate random code using crypto
      const randomBytes = crypto.randomBytes(length);
      let code = '';
      for (let i = 0; i < length; i++) {
        code += characters[randomBytes[i] % characters.length];
      }

      // Check uniqueness in database
      const exists = await this.referralCodeRepo.findOne({
        where: { code },
      });

      if (!exists) {
        return code;
      }

      this.logger.warn(`Code collision detected for: ${code}, retrying...`);
    }

    throw new InternalServerErrorException('Failed to generate unique code');
  }

  /**
   * Generate QR code data URL for the referral code
   * Returns a base64 encoded data URL that can be used directly
   * The actual QR code generation is done client-side using the code
   */
  private generateQrCodeDataUrl(code: string): string {
    const qrPayload = `REF:${code}`;
    // Return base64 encoded plain text as placeholder
    // In production, use a QR code library like 'qrcode' to generate actual QR code images
    return `data:text/plain;base64,${Buffer.from(qrPayload).toString('base64')}`;
  }

  /**
   * Validate if a referral code exists and is active
   */
  async validateReferralCode(code: string): Promise<UserReferralCode | null> {
    const referralCode = await this.referralCodeRepo.findOne({
      where: { code, isActive: true },
    });

    if (referralCode) {
      // Update last used timestamp
      referralCode.lastUsedAt = new Date();
      await this.referralCodeRepo.save(referralCode);
    }

    return referralCode;
  }

  /**
   * Deactivate a user's referral code
   */
  async deactivateCode(userId: number): Promise<void> {
    const referralCode = await this.referralCodeRepo.findOne({
      where: { userId },
    });

    if (referralCode) {
      referralCode.isActive = false;
      await this.referralCodeRepo.save(referralCode);
      this.logger.log(`Deactivated referral code for user ${userId}`);
    }
  }
}
