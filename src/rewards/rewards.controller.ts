import { Controller, Post, Param, ParseIntPipe } from '@nestjs/common';
import { UserBadgeService } from './services/user-badge.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly userBadgeService: UserBadgeService) {}

  // POST /rewards/evaluate/:userId - triggers evaluation of all criteria
  @Post('evaluate/:userId')
  async evaluate(@Param('userId', ParseIntPipe) userId: number) {
    const awarded = await this.userBadgeService.evaluateAndAwardForUser(userId);

    // Defensive: ensure awarded is an array before using .length
    const awardedArray = Array.isArray(awarded) ? awarded : [];
    const message = awardedArray.length ? 'New badges awarded' : 'No new badges';
    return { message, awarded: awardedArray };
  }
}
