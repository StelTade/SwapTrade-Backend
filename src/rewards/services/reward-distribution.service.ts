/**
 * Reward Distribution Service - 奖励自动分配服务
 * 实现推荐完成后的自动奖励发放
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { BalanceAudit, AuditAction } from '../../balance/balance-audit.entity';

export interface RewardConfig {
  referrerReward: number; // 推荐人奖励 ($10)
  refereeReward: number;  // 被推荐人奖励 ($5)
  xpBonus: number;        // XP 奖励
  badgeId?: number;       // 徽章 ID（可选）
}

export interface DistributionResult {
  success: boolean;
  referrerTxId?: number;
  refereeTxId?: number;
  xpTxId?: number;
  error?: string;
}

@Injectable()
export class RewardDistributionService {
  private readonly logger = new Logger(RewardDistributionService.name);
  
  // 默认奖励配置
  private defaultConfig: RewardConfig = {
    referrerReward: 10.00,
    refereeReward: 5.00,
    xpBonus: 100,
    badgeId: 1, // 推荐达人徽章
  };

  constructor(
    private readonly balanceService: BalanceService,
    @InjectRepository(BalanceAudit)
    private readonly auditRepo: Repository<BalanceAudit>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 自动分配奖励（当被推荐人完成 KYC/验证时触发）
   */
  async distributeRewards(
    referrerId: number,
    refereeId: number,
    config?: Partial<RewardConfig>,
  ): Promise<DistributionResult> {
    this.logger.log(`开始分配奖励：推荐人=${referrerId}, 被推荐人=${refereeId}`);

    const finalConfig = { ...this.defaultConfig, ...config };
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 1. 给推荐人发放奖励
      const referrerTx = await this.balanceService.creditBalance(
        referrerId,
        finalConfig.referrerReward,
        'REFERRAL_REWARD',
        `推荐奖励 - 用户 ${refereeId} 完成验证`,
        queryRunner,
      );

      this.logger.log(`✅ 推荐人奖励已发放：$${finalConfig.referrerReward}`);

      // 2. 给被推荐人发放奖励
      const refereeTx = await this.balanceService.creditBalance(
        refereeId,
        finalConfig.refereeReward,
        'REFERRAL_BONUS',
        `被推荐奖励 - 完成验证`,
        queryRunner,
      );

      this.logger.log(`✅ 被推荐人奖励已发放：$${finalConfig.refereeReward}`);

      // 3. 发放 XP 奖励（通过 Rewards 模块）
      // TODO: 集成 XP 系统
      // const xpTx = await this.xpService.addXP(referrerId, finalConfig.xpBonus, 'REFERRAL');

      // 4. 记录审计日志
      await this.logDistribution(
        referrerId,
        refereeId,
        finalConfig,
        referrerTx.id,
        refereeTx.id,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`🎉 奖励分配完成！`);

      return {
        success: true,
        referrerTxId: referrerTx.id,
        refereeTxId: refereeTx.id,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`奖励分配失败：${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 手动触发奖励分配（管理员接口）
   */
  async manualDistribute(
    referrerId: number,
    refereeId: number,
    adminId: number,
    config?: Partial<RewardConfig>,
  ): Promise<DistributionResult> {
    this.logger.log(`管理员手动触发奖励分配：admin=${adminId}`);
    
    // 验证推荐关系
    const isValid = await this.validateReferralRelationship(referrerId, refereeId);
    if (!isValid) {
      throw new BadRequestException('无效的推荐关系');
    }

    return this.distributeRewards(referrerId, refereeId, config);
  }

  /**
   * 验证推荐关系
   */
  private async validateReferralRelationship(
    referrerId: number,
    refereeId: number,
  ): Promise<boolean> {
    // TODO: 查询 referral 表验证关系
    // const referral = await this.referralRepo.findOne({
    //   where: { referrerId, refereeId, status: 'completed' },
    // });
    // return !!referral;
    return true; // 简化实现
  }

  /**
   * 记录奖励分配审计日志
   */
  private async logDistribution(
    referrerId: number,
    refereeId: number,
    config: RewardConfig,
    referrerTxId: number,
    refereeTxId: number,
    queryRunner: any,
  ): Promise<void> {
    const audit = queryRunner.manager.create(BalanceAudit, {
      userId: referrerId,
      action: AuditAction.REFERRAL_REWARD,
      amount: config.referrerReward,
      balanceAfter: 0, // TODO: 获取实际余额
      referenceId: refereeId,
      referenceType: 'referral',
      description: `推荐奖励：用户 ${refereeId} 完成验证`,
      metadata: {
        referrerReward: config.referrerReward,
        refereeReward: config.refereeReward,
        xpBonus: config.xpBonus,
        referrerTxId,
        refereeTxId,
      },
    });

    await queryRunner.manager.save(audit);
  }

  /**
   * 获取当前奖励配置
   */
  getRewardConfig(): RewardConfig {
    return { ...this.defaultConfig };
  }

  /**
   * 更新奖励配置（管理员接口）
   */
  updateRewardConfig(config: Partial<RewardConfig>): RewardConfig {
    if (config.referrerReward !== undefined) {
      this.defaultConfig.referrerReward = config.referrerReward;
    }
    if (config.refereeReward !== undefined) {
      this.defaultConfig.refereeReward = config.refereeReward;
    }
    if (config.xpBonus !== undefined) {
      this.defaultConfig.xpBonus = config.xpBonus;
    }
    
    this.logger.log(`奖励配置已更新：${JSON.stringify(this.defaultConfig)}`);
    return { ...this.defaultConfig };
  }

  /**
   * 批量重新发放失败的奖励（补偿机制）
   */
  async retryFailedDistributions(limit: number = 10): Promise<number> {
    this.logger.log(`开始重试失败的奖励分配...`);
    
    // TODO: 查询失败的分配记录
    // const failed = await this.failedDistributionRepo.find({
    //   where: { status: 'failed', retryCount: LessThan(3) },
    //   take: limit,
    // });

    // let successCount = 0;
    // for (const item of failed) {
    //   const result = await this.distributeRewards(item.referrerId, item.refereeId);
    //   if (result.success) {
    //     successCount++;
    //   }
    // }

    // this.logger.log(`重试完成：成功 ${successCount}/${failed.length}`);
    // return successCount;

    return 0; // 简化实现
  }
}
