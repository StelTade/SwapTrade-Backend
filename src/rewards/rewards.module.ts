import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
