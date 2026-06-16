import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle }           from '@nestjs/throttler';
import { AdminGuard }         from '../common/guards/admin.guard';
import { AdminService }       from './admin.service';
import { AdjustPointsDto }    from './dto/adjust-points.dto';
import { ReferralQueryDto }   from './dto/referral-query.dto';

@Controller('admin')
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  // #201 GET /admin/referrals
  // @Get('referrals')
  // getReferrals(@Query() query: ReferralQueryDto) {
  //   return this.adminService.getReferrals(query);
  // }

  // @Get('referrals/stats')
  // getReferralStats() {
  //   return this.adminService.getReferralStats();
  // }

  // #201 POST /admin/referrals/:id/adjust
  // @Post('referrals/:id/adjust')
  // @HttpCode(HttpStatus.OK)
  // adjustPoints(
  //   @Param('id', ParseUUIDPipe) id: string,
  //   @Body() dto: AdjustPointsDto,
  //   @Request() req: any,
  // ) {
  //   return this.adminService.adjustPoints(id, dto, req.user.id);
  // }
}
