/**
 * Admin Controller - 管理员接口控制器
 * 实现 Waitlist 和 Referral 的管理 API
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import {
  GetWaitlistQueryDto,
  UpdateWaitlistStatusDto,
  ManualInviteDto,
  GetReferralsQueryDto,
  AdjustReferralPointsDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ========== Waitlist 管理接口 ==========

  /**
   * GET /admin/waitlist
   * 获取等待列表（支持分页、过滤、排序）
   */
  @Get('waitlist')
  async getWaitlist(@Query() query: GetWaitlistQueryDto) {
    const result = await this.adminService.getWaitlist(query);
    return {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * PATCH /admin/waitlist/:id/status
   * 更新等待列表状态
   */
  @Patch('waitlist/:id/status')
  async updateWaitlistStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWaitlistStatusDto,
  ) {
    // 从 request 中获取 adminId（由 AdminAuthGuard 注入）
    const adminId = 1; // TODO: 从实际用户对象中获取
    const result = await this.adminService.updateWaitlistStatus(id, dto, adminId);
    return {
      success: true,
      data: result,
      message: '状态更新成功',
    };
  }

  /**
   * POST /admin/waitlist/:id/invite
   * 手动发送邀请
   */
  @Post('waitlist/:id/invite')
  @HttpCode(HttpStatus.OK)
  async manualInvite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ManualInviteDto,
  ) {
    const adminId = 1; // TODO: 从实际用户对象中获取
    const result = await this.adminService.manualInvite(id, adminId, dto.message);
    return {
      success: true,
      data: result,
      message: '邀请已发送',
    };
  }

  // ========== Referral 管理接口 ==========

  /**
   * GET /admin/referrals
   * 获取推荐列表（支持分页、过滤、排序）
   */
  @Get('referrals')
  async getReferrals(@Query() query: GetReferralsQueryDto) {
    const result = await this.adminService.getReferrals(query);
    return {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * POST /admin/referrals/:id/adjust
   * 手动调整推荐积分
   */
  @Post('referrals/:id/adjust')
  @HttpCode(HttpStatus.OK)
  async adjustReferralPoints(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustReferralPointsDto,
  ) {
    const adminId = 1; // TODO: 从实际用户对象中获取
    const result = await this.adminService.adjustReferralPoints(id, dto, adminId);
    return {
      success: true,
      data: result,
      message: '积分调整成功',
    };
  }

  // ========== 健康检查接口 ==========

  /**
   * GET /admin/health
   * 管理员接口健康检查
   */
  @Get('health')
  @Header('Cache-Control', 'no-cache')
  async health() {
    return {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
