import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadge } from '../rewards/entities/user-badge.entity';
// Correct relative import: from src/rewards -> go up one level to src -> user
import { User } from '../user/entities/user.entity';

type UserWithStats = User & {
  tradesCount?: number;
  totalProfit?: number;
  completedTutorial?: boolean;
};

type Criteria = {
  key: string;
  badgeName: string;
  condition: (u: Partial<UserWithStats>) => boolean;
};

/**
 * Achievement criteria.
 * Adjust badgeName and conditions to match your domain logic.
 */
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

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Return badges for a user (most recent first) */
  async findByUserId(userId: number): Promise<UserBadge[]> {
    return this.badgeRepo.find({ where: { userId }, order: { awardedAt: 'DESC' } });
  }

  /** Public API used by TradingService: award a named badge if missing */
  async awardBadge(userId: number, badgeName: string): Promise<UserBadge | null> {
    const user = (await this.userRepo.findOne({ where: { id: userId } })) as UserWithStats | null;
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.badgeRepo.findOne({ where: { userId, badgeName } });
    if (existing) return null;

    const created = this.badgeRepo.create({ userId, badgeName });
    return this.badgeRepo.save(created);
  }

  /** Evaluate all CRITERIA for the user and award any missing badges */
  async evaluateAndAwardForUser(userId: number): Promise<UserBadge[]> {
    const user = (await this.userRepo.findOne({ where: { id: userId } })) as UserWithStats | null;
    if (!user) throw new NotFoundException('User not found');

    const awarded: UserBadge[] = [];
    for (const c of CRITERIA) {
      // Type of `user` includes tradesCount/totalProfit/completedTutorial via UserWithStats
      if (c.condition(user)) {
        const created = await this.awardBadge(userId, c.badgeName);
        if (created) awarded.push(created);
      }
    }
    return awarded;
  }
}
