import { Injectable } from '@nestjs/common';
import { UserBadgeService } from './services/user-badge.service';

@Injectable()
export class RewardsService {
  constructor(private readonly userBadgeService: UserBadgeService) {}

  async evaluateUser(userId: number) {
    return this.userBadgeService.evaluateAndAwardForUser(userId);
  }
}
