import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UserBadgeService } from '../services/user-badge.service';

@Controller('badges')
export class BadgeController {
  constructor(private readonly userBadgeService: UserBadgeService) {}

  // GET /badges/:userId
  @Get(':userId')
  async getUserBadges(@Param('userId', ParseIntPipe) userId: number) {
    const badges = await this.userBadgeService.findByUserId(userId);
    return badges.map((b) => ({
      id: b.id,
      badgeName: b.badgeName,
      awardedAt: b.awardedAt,
    }));
  }
}
