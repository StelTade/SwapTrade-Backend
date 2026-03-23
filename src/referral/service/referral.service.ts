import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Referral, ReferralStatus } from '../entities/referral.entity';
import { RewardConfig, RewardType } from '../entities/reward-config.entity';
import {
  RewardDistribution,
  DistributionStatus,
} from '../entities/reward-distribution.entity';
import { UserBalance } from '../../balance/entities/user-balance.entity';
import { BalanceAudit } from '../../balance/balance-audit.entity';
import { User } from '../../user/entities/user.entity';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';
import { UserBadgeService } from '../../rewards/services/user-badge.service';
import { CreateReferralDto, VerifyReferralDto } from '../dto/referral.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(RewardConfig)
    private readonly rewardConfigRepo: Repository<RewardConfig>,
    @InjectRepository(RewardDistribution)
    private readonly distributionRepo: Repository<RewardDistribution>,
    @InjectRepository(UserBalance)
    private readonly balanceRepo: Repository<UserBalance>,
    @InjectRepository(BalanceAudit)
    private readonly auditRepo: Repository<BalanceAudit>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly userBadgeService: UserBadgeService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new referral relationship
   */
  async createReferral(dto: CreateReferralDto): Promise<Referral> {
    const existing = await this.referralRepo.findOne({
      where: { refereeId: dto.refereeId },
    });

    if (existing) {
      throw new BadRequestException('Referee already has a referrer');
    }

    if (dto.referrerId === dto.refereeId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const referral = this.referralRepo.create({
      referrerId: dto.referrerId,
      refereeId: dto.refereeId,
      referralCode: dto.referralCode,
      status: ReferralStatus.PENDING,
    });

    return this.referralRepo.save(referral);
  }

  /**
   * Verify a referral when referee completes KYC/verification
   * This triggers automatic reward distribution
   */
  async verifyReferral(dto: VerifyReferralDto): Promise<{
    referral: Referral;
    distributions: RewardDistribution[];
  }> {
    const referral = await this.referralRepo.findOne({
      where: { refereeId: dto.refereeId },
      relations: ['referrer', 'referee'],
    });

    if (!referral) {
      throw new BadRequestException('Referral not found');
    }

    if (referral.status === ReferralStatus.VERIFIED) {
      throw new BadRequestException('Referral already verified');
    }

    if (referral.status === ReferralStatus.REWARDED) {
      throw new BadRequestException('Referral already rewarded');
    }

    // Update referral status to VERIFIED
    referral.status = ReferralStatus.VERIFIED;
    referral.verifiedAt = new Date();
    await this.referralRepo.save(referral);

    // Distribute rewards
    const distributions = await this.distributeRewards(referral);

    return { referral, distributions };
  }

  /**
   * Distribute rewards to both referrer and referee
   */
  private async distributeRewards(
    referral: Referral,
  ): Promise<RewardDistribution[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const distributions: RewardDistribution[] = [];

    try {
      // Get reward configurations
      const configs = await this.rewardConfigRepo.find({
        where: { isActive: true },
      });

      if (configs.length === 0) {
        this.logger.warn('No active reward configurations found');
        // Create default configs if none exist
        await this.createDefaultRewardConfigs();
        configs.push(
          ...(await this.rewardConfigRepo.find({ where: { isActive: true } })),
        );
      }

      // Get or create USD asset for balance credits
      let usdAsset = await this.assetRepo.findOne({
        where: { symbol: 'USD' },
      });

      if (!usdAsset) {
        usdAsset = this.assetRepo.create({
          symbol: 'USD',
          name: 'US Dollar',
          price: 1.0,
        });
        usdAsset = await queryRunner.manager.save(usdAsset);
      }

      // Distribute to referrer
      const referrerDistributions = await this.distributeToUser(
        referral.referrerId,
        referral.id,
        configs,
        'REFERRER',
        queryRunner.manager,
        usdAsset.id,
      );
      distributions.push(...referrerDistributions);

      // Distribute to referee
      const refereeDistributions = await this.distributeToUser(
        referral.refereeId,
        referral.id,
        configs,
        'REFEREE',
        queryRunner.manager,
        usdAsset.id,
      );
      distributions.push(...refereeDistributions);

      // Update referral status to REWARDED
      referral.status = ReferralStatus.REWARDED;
      referral.rewardedAt = new Date();
      await queryRunner.manager.save(referral);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Successfully distributed ${distributions.length} rewards for referral #${referral.id}`,
      );

      return distributions;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to distribute rewards', error.stack);
      throw new InternalServerErrorException(
        'Failed to distribute rewards: ' + error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Distribute rewards to a specific user
   */
  private async distributeToUser(
    userId: number,
    referralId: number,
    configs: RewardConfig[],
    recipientType: 'REFERRER' | 'REFEREE',
    manager: any,
    usdAssetId: number,
  ): Promise<RewardDistribution[]> {
    const distributions: RewardDistribution[] = [];
    const userConfigs = configs.filter(
      (c) => c.recipientType === recipientType,
    );

    for (const config of userConfigs) {
      const distribution = this.distributionRepo.create({
        referralId,
        userId,
        rewardType: config.rewardType,
        amount: config.amount,
        recipientType,
        status: DistributionStatus.PENDING,
      });

      try {
        switch (config.rewardType) {
          case RewardType.BALANCE_CREDIT:
            await this.distributeBalanceCredit(
              userId,
              config.amount,
              usdAssetId,
              manager,
            );
            distribution.status = DistributionStatus.COMPLETED;
            distribution.transactionId = `BAL-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`;
            break;

          case RewardType.XP:
            await this.distributeXP(userId, Math.floor(config.amount), manager);
            distribution.status = DistributionStatus.COMPLETED;
            distribution.transactionId = `XP-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`;
            break;

          case RewardType.BADGE:
            await this.distributeBadge(userId, config.description, manager);
            distribution.status = DistributionStatus.COMPLETED;
            distribution.transactionId = `BADGE-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`;
            break;

          case RewardType.TRADING_FEE_DISCOUNT:
            // TODO: Implement trading fee discount logic
            distribution.status = DistributionStatus.COMPLETED;
            distribution.transactionId = `FEE-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 9)}`;
            break;

          default:
            distribution.status = DistributionStatus.FAILED;
            distribution.errorMessage = `Unknown reward type: ${config.rewardType}`;
        }
      } catch (error) {
        distribution.status = DistributionStatus.FAILED;
        distribution.errorMessage = error.message;
        this.logger.error(
          `Failed to distribute ${config.rewardType} to user ${userId}`,
          error.stack,
        );
      }

      await manager.save(distribution);
      distributions.push(distribution);
    }

    return distributions;
  }

  /**
   * Distribute balance credit to user
   */
  private async distributeBalanceCredit(
    userId: number,
    amount: number,
    assetId: number,
    manager: any,
  ): Promise<void> {
    // Find or create user balance
    let balance = await manager.findOne(UserBalance, {
      where: { userId, assetId },
    });

    const previousBalance = balance ? Number(balance.balance) : 0;

    if (balance) {
      balance.balance = Number(balance.balance) + amount;
    } else {
      balance = manager.create(UserBalance, {
        userId,
        assetId,
        balance: amount,
        totalInvested: 0,
        cumulativePnL: 0,
        averageBuyPrice: 0,
      });
    }

    await manager.save(balance);

    // Create audit log
    const audit = manager.create(BalanceAudit, {
      userId: userId.toString(),
      asset: assetId.toString(),
      amountChanged: amount,
      resultingBalance: Number(balance.balance),
      reason: 'Referral reward',
      transactionId: `REF-${Date.now()}`,
      previousBalance,
    });

    await manager.save(audit);
  }

  /**
   * Distribute XP to user
   */
  private async distributeXP(
    userId: number,
    xpAmount: number,
    manager: any,
  ): Promise<void> {
    // Use the existing UserBadgeService to award XP
    // This is a simplified version - in production, you'd integrate with the rewards module properly
    this.logger.log(`Awarded ${xpAmount} XP to user ${userId}`);
  }

  /**
   * Distribute badge to user
   */
  private async distributeBadge(
    userId: number,
    badgeName: string,
    manager: any,
  ): Promise<void> {
    if (!badgeName) return;

    // Use the existing UserBadgeService
    try {
      await this.userBadgeService.evaluateAndAwardForUser(userId);
      this.logger.log(`Awarded badge "${badgeName}" to user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to award badge', error.stack);
    }
  }

  /**
   * Create default reward configurations
   */
  private async createDefaultRewardConfigs(): Promise<void> {
    const defaultConfigs = [
      {
        rewardType: RewardType.BALANCE_CREDIT,
        recipientType: 'REFERRER' as const,
        amount: 10.0,
        description: 'Referrer bonus: $10',
        isActive: true,
      },
      {
        rewardType: RewardType.BALANCE_CREDIT,
        recipientType: 'REFEREE' as const,
        amount: 5.0,
        description: 'Referee bonus: $5',
        isActive: true,
      },
      {
        rewardType: RewardType.XP,
        recipientType: 'REFERRER' as const,
        amount: 100,
        description: 'Referrer XP bonus: 100 XP',
        isActive: true,
      },
      {
        rewardType: RewardType.XP,
        recipientType: 'REFEREE' as const,
        amount: 50,
        description: 'Referee XP bonus: 50 XP',
        isActive: true,
      },
    ];

    for (const config of defaultConfigs) {
      const existing = await this.rewardConfigRepo.findOne({
        where: {
          rewardType: config.rewardType,
          recipientType: config.recipientType,
        },
      });

      if (!existing) {
        await this.rewardConfigRepo.save(config);
      }
    }
  }

  /**
   * Get referral by referee ID
   */
  async getReferralByRefereeId(refereeId: number): Promise<Referral | null> {
    return await this.referralRepo.findOne({
      where: { refereeId },
      relations: ['referrer', 'referee'],
    });
  }

  /**
   * Get all referrals for a referrer
   */
  async getReferralsByReferrerId(referrerId: number): Promise<Referral[]> {
    return this.referralRepo.find({
      where: { referrerId },
      relations: ['referee'],
    });
  }

  /**
   * Get reward distributions for a referral
   */
  async getDistributionsByReferralId(
    referralId: number,
  ): Promise<RewardDistribution[]> {
    return this.distributionRepo.find({
      where: { referralId },
      relations: ['user'],
    });
  }

  /**
   * Update reward configuration
   */
  async updateRewardConfig(
    id: number,
    updates: Partial<RewardConfig>,
  ): Promise<RewardConfig> {
    const config = await this.rewardConfigRepo.findOne({ where: { id } });

    if (!config) {
      throw new BadRequestException('Reward config not found');
    }

    Object.assign(config, updates);
    return this.rewardConfigRepo.save(config);
  }

  /**
   * Get all reward configurations
   */
  async getAllRewardConfigs(): Promise<RewardConfig[]> {
    return this.rewardConfigRepo.find();
  }
}
