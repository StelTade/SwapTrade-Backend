import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReferralService } from './service/referral.service';
import { CreateReferralDto, VerifyReferralDto } from './dto/referral.dto';
import { Referral } from './entities/referral.entity';
import { RewardDistribution } from './entities/reward-distribution.entity';
import { RewardConfig } from './entities/reward-config.entity';

@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * Create a new referral relationship
   */
  @Post()
  async createReferral(
    @Body() dto: CreateReferralDto,
  ): Promise<{ referral: Referral }> {
    const referral = await this.referralService.createReferral(dto);
    return { referral };
  }

  /**
   * Verify a referral (triggered when referee completes KYC/verification)
   * This automatically distributes rewards
   */
  @Post('verify')
  async verifyReferral(
    @Body() dto: VerifyReferralDto,
  ): Promise<{
    referral: Referral;
    distributions: RewardDistribution[];
  }> {
    const result = await this.referralService.verifyReferral(dto);
    return result;
  }

  /**
   * Get referral by referee ID
   */
  @Get('referee/:refereeId')
  async getReferralByRefereeId(
    @Param('refereeId', ParseIntPipe) refereeId: number,
  ): Promise<{ referral: Referral | null }> {
    const referral = await this.referralService.getReferralByRefereeId(
      refereeId,
    );
    return { referral };
  }

  /**
   * Get all referrals for a referrer
   */
  @Get('referrer/:referrerId')
  async getReferralsByReferrerId(
    @Param('referrerId', ParseIntPipe) referrerId: number,
  ): Promise<{ referrals: Referral[] }> {
    const referrals = await this.referralService.getReferralsByReferrerId(
      referrerId,
    );
    return { referrals };
  }

  /**
   * Get reward distributions for a referral
   */
  @Get(':referralId/distributions')
  async getDistributionsByReferralId(
    @Param('referralId', ParseIntPipe) referralId: number,
  ): Promise<{ distributions: RewardDistribution[] }> {
    const distributions =
      await this.referralService.getDistributionsByReferralId(referralId);
    return { distributions };
  }

  /**
   * Get all reward configurations
   */
  @Get('config')
  async getAllRewardConfigs(): Promise<{ configs: RewardConfig[] }> {
    const configs = await this.referralService.getAllRewardConfigs();
    return { configs };
  }

  /**
   * Update reward configuration
   */
  @Post('config/:id')
  async updateRewardConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() updates: Partial<RewardConfig>,
  ): Promise<{ config: RewardConfig }> {
    const config = await this.referralService.updateRewardConfig(id, updates);
    return { config };
  }
}
