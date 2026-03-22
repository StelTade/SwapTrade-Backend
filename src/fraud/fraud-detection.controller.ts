/**
 * Fraud Detection Controller - 反欺诈检测接口
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
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';
import { AdminAuthGuard } from '../admin/guards/admin-auth.guard';

export class CheckWaitlistDto {
  email: string;
  fingerprint?: string;
}

export class CheckReferralDto {
  referrerId: number;
  refereeId: number;
  refereeIP?: string;
}

export class DisableAccountDto {
  reason: string;
}

@Controller('fraud')
export class FraudDetectionController {
  constructor(
    private readonly fraudService: FraudDetectionService,
  ) {}

  /**
   * POST /fraud/check/waitlist
   * 检查等待列表注册风险
   */
  @Post('check/waitlist')
  async checkWaitlist(
    @Body() dto: CheckWaitlistDto,
    @Ip() ip: string,
  ) {
    const result = await this.fraudService.checkWaitlistSignup(
      dto.email,
      ip,
      dto.fingerprint,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /fraud/check/referral
   * 检查推荐风险
   */
  @Post('check/referral')
  async checkReferral(@Body() dto: CheckReferralDto) {
    const result = await this.fraudService.checkReferral(
      dto.referrerId,
      dto.refereeId,
      dto.refereeIP,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /fraud/suspicious
   * 获取可疑记录队列（管理员）
   */
  @Get('suspicious')
  @UseGuards(AdminAuthGuard)
  async getSuspiciousQueue(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    const queue = await this.fraudService.getSuspiciousQueue(page, limit);
    return {
      success: true,
      data: queue,
    };
  }

  /**
   * POST /fraud/account/:id/disable
   * 禁用欺诈账户（管理员）
   */
  @Post('account/:id/disable')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableAccount(
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: DisableAccountDto,
    @Headers('x-admin-id') adminId: number,
  ) {
    await this.fraudService.disableFraudAccount(userId, adminId, dto.reason);
    return {
      success: true,
      message: `账户 ${userId} 已禁用`,
    };
  }

  /**
   * GET /fraud/config
   * 获取反欺诈配置
   */
  @Get('config')
  @UseGuards(AdminAuthGuard)
  getConfig() {
    return {
      success: true,
      data: {
        ipSignupLimit: 10,
        ipSignupWindow: 10,
        referralDomainThreshold: 5,
        highRiskScore: 80,
        challengeScore: 50,
      },
    };
  }
}
