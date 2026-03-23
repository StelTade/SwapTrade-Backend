/**
 * Referral Tracking Controller - 推荐追踪接口
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReferralTrackingService } from './services/referral-tracking.service';

export class CreateReferralDto {
  referrerId: number;
  refereeId: number;
  referralCode?: string;
  refereeIP?: string;
}

export class VerifyReferralDto {
  refereeId: number;
  verifiedEmail: string;
}

@Controller('api/waitlist/referral')
export class ReferralTrackingController {
  constructor(
    private readonly referralService: ReferralTrackingService,
  ) {}

  /**
   * POST /api/waitlist/referral
   * 创建推荐关系
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReferral(@Body() dto: CreateReferralDto) {
    const referral = await this.referralService.createReferral(dto);
    return {
      success: true,
      data: referral,
      message: '推荐关系创建成功',
    };
  }

  /**
   * POST /api/waitlist/referral/callback
   * 推荐回调（验证邮箱时调用）
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async verifyReferral(@Body() dto: VerifyReferralDto) {
    const referral = await this.referralService.verifyReferral(dto);
    
    if (!referral) {
      return {
        success: false,
        message: '未找到推荐记录',
      };
    }

    return {
      success: true,
      data: referral,
      message: '推荐验证成功，积分已发放',
    };
  }

  /**
   * GET /api/waitlist/referral/user/:id
   * 获取用户推荐统计
   */
  @Get('user/:userId')
  async getUserStats(@Param('userId', ParseIntPipe) userId: number) {
    const stats = await this.referralService.getUserReferralStats(userId);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * GET /api/waitlist/referral/user/:id/list
   * 获取用户推荐列表
   */
  @Get('user/:userId/list')
  async getUserReferrals(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const referrals = await this.referralService.getUserReferrals(
      userId,
      page,
      limit,
    );
    return {
      success: true,
      data: referrals,
    };
  }

  /**
   * GET /api/waitlist/referral/code/:code
   * 验证推荐码
   */
  @Get('code/:code')
  async validateCode(@Param('code') code: string) {
    const isValid = await this.referralService.validateReferralCode(code);
    return {
      success: true,
      data: {
        valid: isValid,
        code,
      },
    };
  }
}
