import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadge } from '../entities/user-badge.entity';

@Injectable()
export class UserBadgeService {
  constructor(
    @InjectRepository(UserBadge)
    private readonly userBadgeRepository: Repository<UserBadge>,
  ) {}

  async hasBadge(userId: number, badgeName: string): Promise<boolean> {
    const badge = await this.userBadgeRepository.findOne({ where: { userId, badgeName } });
    return !!badge;
  }

  async awardBadge(userId: number, badgeName: string): Promise<UserBadge | null> {
    if (await this.hasBadge(userId, badgeName)) {
      return null;
    }
    const badge = this.userBadgeRepository.create({ userId, badgeName });
    return await this.userBadgeRepository.save(badge);
  }
}
