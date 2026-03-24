import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { WaitlistUser, WaitlistStatus } from './entities/waitlist-user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { WaitlistSignupDto } from './dto/waitlist-signup.dto';
import { WaitlistVerifyDto } from './dto/waitlist-verify.dto';

const TOKEN_EXPIRY_HOURS = 72;

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistUser)
    private readonly waitlistUserRepo: Repository<WaitlistUser>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepo: Repository<VerificationToken>,
  ) {}

  async signup(dto: WaitlistSignupDto): Promise<{ message: string }> {
    const existing = await this.waitlistUserRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      if (existing.status === WaitlistStatus.VERIFIED) {
        throw new ConflictException('Email already verified and registered.');
      }
      throw new ConflictException('Email already on the waitlist. Please verify your email.');
    }

    const user = this.waitlistUserRepo.create({
      email: dto.email,
      name: dto.name,
      referralCode: this.generateReferralCode(),
      referredBy: dto.referralCode,
      status: WaitlistStatus.PENDING,
    });

    await this.waitlistUserRepo.save(user);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    const verificationToken = this.verificationTokenRepo.create({
      token,
      expiresAt,
      used: false,
      waitlistUser: user,
    });

    await this.verificationTokenRepo.save(verificationToken);

    // TODO: Send email with token (log for now)
    console.log(`[WAITLIST] Verification token for ${dto.email}: ${token}`);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async verify(dto: WaitlistVerifyDto): Promise<{ message: string }> {
    const verificationToken = await this.verificationTokenRepo.findOne({
      where: { token: dto.token, used: false },
      relations: ['waitlistUser'],
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token.');
    }

    if (new Date() > verificationToken.expiresAt) {
      throw new BadRequestException('Verification token has expired.');
    }

    if (verificationToken.used) {
      throw new BadRequestException('Verification token has already been used.');
    }

    verificationToken.used = true;
    await this.verificationTokenRepo.save(verificationToken);

    const user = verificationToken.waitlistUser;
    user.status = WaitlistStatus.VERIFIED;
    await this.waitlistUserRepo.save(user);

    return {
      message: 'Email verified successfully. You are now on the waitlist!',
    };
  }

  private generateReferralCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }
}
