// src/rewards/services/user-badge.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadge } from '../entities/user-badge.entity';

type UserWithStats = {
  id: number;
  tradesCount?: number;
  totalProfit?: number;
  completedTutorial?: boolean;
};

type Criteria = {
  key: string;
  badgeName: string;
  condition: (u: Partial<UserWithStats>) => boolean;
};

const CRITERIA: Criteria[] = [
  { key: 'first_trade', badgeName: 'First Trade', condition: (u) => (u.tradesCount ?? 0) >= 1 },
  { key: 'profit_1000', badgeName: 'Profit Hunter', condition: (u) => (u.totalProfit ?? 0) >= 1000 },
  { key: 'tutorial_complete', badgeName: 'Learner', condition: (u) => u.completedTutorial === true },
];

@Injectable()
export class UserBadgeService {
  constructor(
    @InjectRepository(UserBadge)
    private readonly badgeRepo: Repository<UserBadge>,
  ) {}

  async findByUserId(userId: number): Promise<UserBadge[]> {
    return this.badgeRepo.find({ where: { userId }, order: { awardedAt: 'DESC' } });
  }

  /** Public API used by TradingService: award a named badge if missing */
  async awardBadge(userId: number, badgeName: string): Promise<UserBadge | null> {
    const existing = await this.badgeRepo.findOne({ where: { userId, badgeName } });
    if (existing) return null;

    const created = this.badgeRepo.create({ userId, badgeName });
    return this.badgeRepo.save(created);
  }

  /** Evaluate all CRITERIA for user and award any missing badges */
  async evaluateAndAwardForUser(userId: number): Promise<UserBadge[]> {
    const awarded: UserBadge[] = [];
    for (const c of CRITERIA) {
      // Simplified awarding without user stats check for now
      const created = await this.awardBadge(userId, c.badgeName);
      if (created) awarded.push(created);
    }
    return awarded;
  }
}
