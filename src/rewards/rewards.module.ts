import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { UserBadgeModule } from './user-badge.module';

@Module({
  imports: [UserBadgeModule],
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [UserBadgeModule],
})
export class RewardsModule {}
