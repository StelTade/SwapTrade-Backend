/**
 * Referral Tracking Service - 推荐追踪服务
 * 实现推荐关系追踪和积分发放逻辑
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  WaitlistReferral,
  ReferralStatus,
} from './entities/waitlist-referral.entity';
import {
  WaitlistReferralPoints,
  PointsReason,
} from './entities/waitlist-referral-points.entity';

export interface CreateReferralDto {
  referrerId: number;
  refereeId: number;
  referralCode?: string;
  refereeIP?: string;
}

export interface VerifyReferralDto {
  refereeId: number;
  verifiedEmail: string;
}

@Injectable()
export class ReferralTrackingService {
  private readonly logger = new Logger(ReferralTrackingService.name);

  private readonly REFERRAL_POINTS = 1; // 每个有效推荐 1 积分

  constructor(
    @InjectRepository(WaitlistReferral)
    private readonly referralRepo: Repository<WaitlistReferral>,
    @InjectRepository(WaitlistReferralPoints)
    private readonly pointsRepo: Repository<WaitlistReferralPoints>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建推荐关系
   */
  async createReferral(dto: CreateReferralDto): Promise<WaitlistReferral> {
    const { referrerId, refereeId, referralCode, refereeIP } = dto;

    this.logger.log(`创建推荐关系：referrer=${referrerId}, referee=${refereeId}`);

    // 1. 检查自我推荐
    if (referrerId === refereeId) {
      throw new BadRequestException('禁止自我推荐');
    }

    // 2. 检查是否已被推荐
    const existing = await this.referralRepo.findOne({
      where: { refereeId },
    });

    if (existing) {
      throw new ConflictException('该用户已被其他用户推荐');
    }

    // 3. 创建推荐记录
    const referral = this.referralRepo.create({
      referrerId,
      refereeId,
      referralCode,
      refereeIP,
      status: ReferralStatus.PENDING,
    });

    return await this.referralRepo.save(referral);
  }

  /**
   * 验证推荐（当被推荐人验证邮箱时调用）
   */
  async verifyReferral(dto: VerifyReferralDto): Promise<WaitlistReferral> {
    const { refereeId, verifiedEmail } = dto;

    this.logger.log(`验证推荐：referee=${refereeId}, email=${verifiedEmail}`);

    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 1. 查找推荐记录
      const referral = await queryRunner.manager.findOne(WaitlistReferral, {
        where: { refereeId },
      });

      if (!referral) {
        this.logger.warn(`未找到推荐记录：referee=${refereeId}`);
        return null;
      }

      if (referral.status !== ReferralStatus.PENDING) {
        this.logger.warn(`推荐记录状态不正确：${referral.status}`);
        return referral;
      }

      // 2. 更新状态为已验证
      referral.status = ReferralStatus.VERIFIED;
      referral.verifiedAt = new Date();
      await queryRunner.manager.save(referral);

      // 3. 发放积分给推荐人
      await this.awardPoints(
        referral.referrerId,
        referral.id,
        queryRunner,
      );

      // 4. 更新状态为已奖励
      referral.status = ReferralStatus.REWARDED;
      referral.rewardedAt = new Date();
      await queryRunner.manager.save(referral);

      await queryRunner.commitTransaction();

      this.logger.log(`推荐验证完成：referralId=${referral.id}`);

      return referral;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`推荐验证失败：${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 发放积分
   */
  private async awardPoints(
    userId: number,
    referralId: number,
    queryRunner: any,
  ): Promise<WaitlistReferralPoints> {
    this.logger.log(`发放积分：userId=${userId}, points=${this.REFERRAL_POINTS}`);

    const pointsRecord = queryRunner.manager.create(WaitlistReferralPoints, {
      userId,
      points: this.REFERRAL_POINTS,
      reason: PointsReason.REFERRAL_VERIFIED,
      referralId,
      description: `推荐奖励 - 推荐用户完成验证`,
      transactionRef: `REF-${referralId}-${Date.now()}`,
    });

    return await queryRunner.manager.save(pointsRecord);
  }

  /**
   * 获取用户的推荐统计
   */
  async getUserReferralStats(userId: number) {
    const total = await this.referralRepo.count({
      where: { referrerId: userId },
    });

    const verified = await this.referralRepo.count({
      where: { referrerId: userId, status: ReferralStatus.VERIFIED },
    });

    const rewarded = await this.referralRepo.count({
      where: { referrerId: userId, status: ReferralStatus.REWARDED },
    });

    const totalPoints = await this.pointsRepo
      .createQueryBuilder('points')
      .select('SUM(points.points)', 'total')
      .where('points.userId = :userId', { userId })
      .getRawOne();

    return {
      totalReferrals: total,
      verifiedReferrals: verified,
      rewardedReferrals: rewarded,
      totalPoints: totalPoints?.total || 0,
    };
  }

  /**
   * 获取用户的推荐列表
   */
  async getUserReferrals(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const [data, total] = await this.referralRepo.findAndCount({
      where: { referrerId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 检查推荐码是否有效
   */
  async validateReferralCode(referralCode: string): Promise<boolean> {
    if (!referralCode) {
      return false;
    }

    const referral = await this.referralRepo.findOne({
      where: { referralCode },
    });

    return !!referral;
  }

  /**
   * 通过推荐码获取推荐人 ID
   */
  async getReferrerByCode(referralCode: string): Promise<number | null> {
    const referral = await this.referralRepo.findOne({
      where: { referralCode },
    });

    return referral?.referrerId || null;
  }
}
