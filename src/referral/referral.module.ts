/**
 * Referral Module - 推荐追踪模块
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralTrackingController } from './referral-tracking.controller';
import { ReferralTrackingService } from './services/referral-tracking.service';
import { WaitlistReferral } from './entities/waitlist-referral.entity';
import { WaitlistReferralPoints } from './entities/waitlist-referral-points.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistReferral, WaitlistReferralPoints]),
  ],
  controllers: [ReferralTrackingController],
  providers: [ReferralTrackingService],
  exports: [ReferralTrackingService],
})
export class ReferralModule {}
