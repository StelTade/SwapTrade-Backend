import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WaitlistUser,
  WaitlistUserStatus,
} from './entities/waitlist-user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { SignupWaitlistDto, VerifyWaitlistDto } from './dto';
import { ReferralService } from '../referral/referral.service';
import { randomBytes } from 'crypto';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistUser)
    private readonly waitlistUserRepository: Repository<WaitlistUser>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    private readonly referralService: ReferralService,
  ) {}

  private generateReferralCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async signup(
    dto: SignupWaitlistDto,
  ): Promise<{ user: WaitlistUser; message: string }> {
    const existingUser = await this.waitlistUserRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      if (existingUser.status === WaitlistUserStatus.VERIFIED) {
        throw new ConflictException('Email already registered and verified');
      }
      throw new ConflictException(
        'Email already registered. Please verify your email.',
      );
    }

    let referralCode = dto.referralCode;
    if (referralCode) {
      const referrer = await this.waitlistUserRepository.findOne({
        where: { referralCode },
      });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }
    }

    const user = this.waitlistUserRepository.create({
      email: dto.email,
      name: dto.name || null,
      referralCode: this.generateReferralCode(),
      referredBy: referralCode || null,
      status: WaitlistUserStatus.PENDING,
    });

    const savedUser = await this.waitlistUserRepository.save(user);

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const verificationToken = this.verificationTokenRepository.create({
      token,
      waitlistUserId: savedUser.id,
      expiresAt,
      used: false,
    });

    await this.verificationTokenRepository.save(verificationToken);

    this.logger.log(`Verification email sent to ${dto.email}. Token: ${token}`);

    return {
      user: savedUser,
      message: `Verification email sent to ${dto.email}`,
    };
  }

  async verify(
    dto: VerifyWaitlistDto,
  ): Promise<{ user: WaitlistUser; message: string }> {
    const token = await this.verificationTokenRepository.findOne({
      where: { token: dto.token, used: false },
      relations: ['waitlistUser'],
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (token.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    const user = token.waitlistUser;
    if (user.status === WaitlistUserStatus.VERIFIED) {
      throw new ConflictException('Email already verified');
    }

    user.status = WaitlistUserStatus.VERIFIED;
    await this.waitlistUserRepository.save(user);

    token.used = true;
    await this.verificationTokenRepository.save(token);

    this.logger.log(`Email verified for user ${user.id} (${user.email})`);

    if (user.referredBy) {
      this.logger.log(
        `Processing referral for user ${user.id}, referred by ${user.referredBy}`,
      );
      await this.referralService.processReferralCallback({
        referralCode: user.referredBy,
        refereeId: user.id,
        refereeIP: null,
      });
    }

    return {
      user,
      message: 'Email verified successfully. You are now on the waitlist!',
    };
  }

  async getUserById(id: string): Promise<WaitlistUser> {
    const user = await this.waitlistUserRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Waitlist user with ID ${id} not found`);
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<WaitlistUser | null> {
    return this.waitlistUserRepository.findOne({
      where: { email },
    });
  }

  async getUserByReferralCode(code: string): Promise<WaitlistUser | null> {
    return this.waitlistUserRepository.findOne({
      where: { referralCode: code },
    });
  }
}
