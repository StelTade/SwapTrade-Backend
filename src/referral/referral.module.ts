import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralController } from './referral.controller';
import { ReferralService } from './service/referral.service';
import { ReferralCodeService } from './service/referral-code.service';
import { Referral } from './entities/referral.entity';
import { RewardConfig } from './entities/reward-config.entity';
import { RewardDistribution } from './entities/reward-distribution.entity';
import { UserReferralCode } from './entities/user-referral-code.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { User } from '../user/entities/user.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { UserBadge } from '../rewards/entities/user-badge.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Referral,
      RewardConfig,
      RewardDistribution,
      UserReferralCode,
      UserBalance,
      BalanceAudit,
      User,
      VirtualAsset,
      UserBadge,
    ]),
  ],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralCodeService, UserBadgeService],
  exports: [ReferralService, ReferralCodeService],
})
export class ReferralModule {}
