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

  async findByUserId(userId: number): Promise<UserBadge[]> {
    return this.userBadgeRepository.find({ where: { userId } });
  }
}


