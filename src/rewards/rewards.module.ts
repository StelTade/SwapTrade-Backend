import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { BadgeController } from './controllers/badge.controller';
import { UserBadgeService } from './services/user-badge.service';
import { UserBadge } from './entities/user-badge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserBadge])],
  controllers: [RewardsController, BadgeController],
  providers: [RewardsService, UserBadgeService],
  exports: [UserBadgeService],
})
export class RewardsModule {}
