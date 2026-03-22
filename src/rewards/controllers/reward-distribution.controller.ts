/**
 * Reward Distribution Controller - 奖励分配接口
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RewardDistributionService, RewardConfig } from '../services/reward-distribution.service';
import { AdminAuthGuard } from '../../admin/guards/admin-auth.guard';

export class ManualDistributeDto {
  referrerId: number;
  refereeId: number;
  referrerReward?: number;
  refereeReward?: number;
  reason?: string;
}

export class UpdateConfigDto {
  referrerReward?: number;
  refereeReward?: number;
  xpBonus?: number;
}

@Controller('rewards/distribution')
export class RewardDistributionController {
  constructor(
    private readonly distributionService: RewardDistributionService,
  ) {}

  /**
   * GET /rewards/distribution/config
   * 获取当前奖励配置
   */
  @Get('config')
  @UseGuards(AdminAuthGuard)
  getConfig() {
    const config = this.distributionService.getRewardConfig();
    return {
      success: true,
      data: config,
    };
  }

  /**
   * PUT /rewards/distribution/config
   * 更新奖励配置
   */
  @Post('config')
  @UseGuards(AdminAuthGuard)
  updateConfig(@Body() dto: UpdateConfigDto) {
    const config = this.distributionService.updateRewardConfig(dto);
    return {
      success: true,
      data: config,
      message: '配置已更新',
    };
  }

  /**
   * POST /rewards/distribution/manual
   * 手动触发奖励分配（管理员）
   */
  @Post('manual')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async manualDistribute(@Body() dto: ManualDistributeDto) {
    const adminId = 1; // TODO: 从实际用户对象获取
    
    const config = {
      referrerReward: dto.referrerReward,
      refereeReward: dto.refereeReward,
    };

    const result = await this.distributionService.manualDistribute(
      dto.referrerId,
      dto.refereeId,
      adminId,
      config,
    );

    if (result.success) {
      return {
        success: true,
        data: {
          referrerTxId: result.referrerTxId,
          refereeTxId: result.refereeTxId,
        },
        message: '奖励分配成功',
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  }

  /**
   * POST /rewards/distribution/retry
   * 重试失败的奖励分配
   */
  @Post('retry')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async retryFailed(@Body('limit') limit: number = 10) {
    const count = await this.distributionService.retryFailedDistributions(limit);
    return {
      success: true,
      data: {
        retriedCount: count,
        limit,
      },
      message: `重试完成：成功 ${count} 个`,
    };
  }
}
