import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WithdrawalService } from './services/withdrawal.service';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { RejectWithdrawalDto } from './dto/reject-withdrawal.dto';

/**
 * Admin withdrawal-approval API. Guarded by {@link AdminGuard} (role check) and,
 * per acceptance criterion #4, every mutating route additionally requires the
 * approving admin to pass 2FA — enforced inside {@link WithdrawalService}.
 */
@ApiTags('wallet-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('wallet/admin')
export class WalletAdminController {
  constructor(private readonly withdrawals: WithdrawalService) {}

  @Get('withdrawals/pending')
  @ApiOperation({ summary: 'List withdrawals awaiting admin approval' })
  listPending() {
    return this.withdrawals.listPendingApprovals();
  }

  @Post('withdrawals/:id/approve')
  @ApiOperation({ summary: 'Approve a pending withdrawal (2FA enforced)' })
  approve(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.withdrawals.approveWithdrawal(admin.sub, id, dto.twoFactorToken);
  }

  @Post('withdrawals/:id/reject')
  @ApiOperation({ summary: 'Reject a pending withdrawal (2FA enforced)' })
  reject(
    @CurrentUser() admin: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.withdrawals.rejectWithdrawal(
      admin.sub,
      id,
      dto.reason,
      dto.twoFactorToken,
    );
  }
}
