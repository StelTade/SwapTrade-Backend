import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KycStatus } from './enum/kyc-status.enum';
import { KycService } from './kyc.service';
import { KycRolesGuard } from './guards/kyc-roles.guards';
import { KycRole } from './enum/kyc-role.enum';
import { Roles } from './roles.decorator';
import { KycGuard } from './guards/kyc.guards';

class UpdateKycStatusDto {
  nextStatus!: KycStatus;
  notes?: string;
}

class GovernanceOverrideDto {
  nextStatus!: KycStatus;
  notes!: string;
}

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /** Operator updates KYC status — requires KYC_OPERATOR role */
  @Patch(':userId/status')
  @Roles(KycRole.KYC_OPERATOR)
  @UseGuards(KycRolesGuard)
  updateStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateKycStatusDto,
    @Req() req: { user: { id: number; roles: KycRole[] } },
  ) {
    return this.kycService.updateStatus(
      userId,
      dto.nextStatus,
      req.user,
      dto.notes,
    );
  }

  /** Governance override — bypasses terminal-state lock */
  @Post(':userId/governance-override')
  @Roles(KycRole.KYC_GOVERNANCE)
  @UseGuards(KycRolesGuard)
  governanceOverride(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: GovernanceOverrideDto,
    @Req() req: { user: { id: number; roles: KycRole[] } },
  ) {
    return this.kycService.governanceOverride(
      userId,
      dto.nextStatus,
      req.user,
      dto.notes,
    );
  }

  /** Protected resource — requires verified KYC */
  @Get(':userId/profile')
  @UseGuards(KycGuard)
  getProfile(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: { user: { id: number; roles: string[] } },
  ) {
    return this.kycService.getRecord(userId, req.user);
  }
}
