import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WaitlistReferral,
  ReferralStatus,
} from './entities/waitlist-referral.entity';
import {
  WaitlistReferralPoints,
  PointsReason,
} from './entities/waitlist-referral-points.entity';
import { ReferralCallbackDto, CreateReferralDto } from './dto';
import { WaitlistService } from '../waitlist/waitlist.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly POINTS_PER_REFERRAL = 1;

  constructor(
    @InjectRepository(WaitlistReferral)
    private readonly referralRepository: Repository<WaitlistReferral>,
    @InjectRepository(WaitlistReferralPoints)
    private readonly pointsRepository: Repository<WaitlistReferralPoints>,
    @Inject(forwardRef(() => WaitlistService))
    private readonly waitlistService: WaitlistService,
  ) {}

  private generateTransactionRef(): string {
    return `TXN-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  async createReferral(dto: CreateReferralDto): Promise<WaitlistReferral> {
    if (dto.referrerId === dto.refereeId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const existingReferral = await this.referralRepository.findOne({
      where: {
        referrerId: dto.referrerId,
        refereeId: dto.refereeId,
      },
    });

    if (existingReferral) {
      throw new BadRequestException('Referral already exists');
    }

    const referral = this.referralRepository.create({
      referrerId: dto.referrerId,
      refereeId: dto.refereeId,
      referralCode: dto.referralCode || '',
      status: ReferralStatus.PENDING,
    });

    return this.referralRepository.save(referral);
  }

  async processReferralCallback(
    dto: ReferralCallbackDto,
  ): Promise<{
    referral: WaitlistReferral;
    points: WaitlistReferralPoints | null;
  }> {
    if (dto.referrerId === dto.refereeId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const existingReferral = await this.referralRepository.findOne({
      where: {
        referrerId: dto.referrerId,
        refereeId: dto.refereeId,
      },
    });

    if (existingReferral) {
      if (existingReferral.status !== ReferralStatus.PENDING) {
        throw new BadRequestException('Referral already processed');
      }

      existingReferral.status = ReferralStatus.VERIFIED;
      existingReferral.verifiedAt = new Date();
      existingReferral.refereeIP = dto.refereeIP || null;
      const updatedReferral =
        await this.referralRepository.save(existingReferral);

      await this.awardPoints(dto.referrerId, existingReferral.id);

      this.logger.log(
        `Referral verified: ${dto.referrerId} -> ${dto.refereeId}`,
      );

      return { referral: updatedReferral, points: null };
    }

    const referrer = await this.waitlistService.getUserByReferralCode(
      dto.referralCode,
    );
    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    const referral = this.referralRepository.create({
      referrerId: referrer.id,
      refereeId: dto.refereeId,
      referralCode: dto.referralCode,
      refereeIP: dto.refereeIP || null,
      status: ReferralStatus.VERIFIED,
      verifiedAt: new Date(),
    });

    const savedReferral = await this.referralRepository.save(referral);

    const points = await this.awardPoints(referrer.id, savedReferral.id);

    this.logger.log(
      `Referral processed: ${referrer.id} -> ${dto.refereeId}, points awarded: ${this.POINTS_PER_REFERRAL}`,
    );

    return { referral: savedReferral, points };
  }

  private async awardPoints(
    userId: number,
    referralId: number,
  ): Promise<WaitlistReferralPoints> {
    const points = this.pointsRepository.create({
      userId,
      points: this.POINTS_PER_REFERRAL,
      reason: PointsReason.REFERRAL_SIGNUP,
      referralId,
      description: `Referral signup bonus for referring user ${userId}`,
      transactionRef: this.generateTransactionRef(),
    });

    const savedPoints = await this.pointsRepository.save(points);

    const referral = await this.referralRepository.findOne({
      where: { id: referralId },
    });
    if (referral) {
      referral.status = ReferralStatus.REWARDED;
      referral.rewardedAt = new Date();
      await this.referralRepository.save(referral);
    }

    return savedPoints;
  }

  async getUserReferralStats(userId: number): Promise<{
    userId: number;
    totalReferrals: number;
    verifiedReferrals: number;
    totalPoints: number;
    pointsHistory: WaitlistReferralPoints[];
  }> {
    const referrals = await this.referralRepository.find({
      where: { referrerId: userId },
    });

    const pointsHistory = await this.pointsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const totalPoints = pointsHistory.reduce(
      (sum, p) => sum + Number(p.points),
      0,
    );

    return {
      userId,
      totalReferrals: referrals.length,
      verifiedReferrals: referrals.filter(
        (r) =>
          r.status === ReferralStatus.VERIFIED ||
          r.status === ReferralStatus.REWARDED,
      ).length,
      totalPoints,
      pointsHistory,
    };
  }

  async getUserReferrals(userId: number): Promise<WaitlistReferral[]> {
    return this.referralRepository.find({
      where: { referrerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getReferralByCode(code: string): Promise<WaitlistReferral[]> {
    return this.referralRepository.find({
      where: { referralCode: code },
      order: { createdAt: 'DESC' },
    });
  }

  async getReferralById(id: number): Promise<WaitlistReferral> {
    const referral = await this.referralRepository.findOne({
      where: { id },
    });

    if (!referral) {
      throw new NotFoundException(`Referral with ID ${id} not found`);
    }

    return referral;
  }
}
