import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { BadgeController } from './controllers/badge.controller';
import { UserBadgeService } from './services/user-badge.service';
import { UserBadge } from './entities/user-badge.entity';
import { RewardDistributionController } from './controllers/reward-distribution.controller';
import { RewardDistributionService } from './services/reward-distribution.service';
import { BalanceAudit } from '../balance/balance-audit.entity';
import { BalanceModule } from '../balance/balance.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBadge, BalanceAudit]),
    BalanceModule,
    AdminModule,
  ],
  controllers: [RewardsController, BadgeController, RewardDistributionController],
  providers: [RewardsService, UserBadgeService, RewardDistributionService],
  exports: [UserBadgeService, RewardDistributionService],
})
export class RewardsModule {}
