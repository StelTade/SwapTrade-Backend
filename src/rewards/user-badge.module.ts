import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserBadge } from '../entities/user-badge.entity';
import { UserBadgeService } from '../services/user-badge.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserBadge])],
  providers: [UserBadgeService],
  exports: [UserBadgeService],
})
export class UserBadgeModule {}
