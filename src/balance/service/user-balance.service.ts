import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBalance } from '../user-balance.entity';

@Injectable()
export class UserBalanceService {
  constructor(
    @InjectRepository(UserBalance)
    private readonly balanceRepo: Repository<UserBalance>,
  ) {}

  async addBalance(userId: string, assetId: string, amount: number) {
    let balance = await this.balanceRepo.findOne({
      where: { userId, assetId },
      relations: ['user', 'asset'], // Eager load user and virtual asset
    });

    if (balance) {
      balance.amount += amount;
    } else {
      balance = this.balanceRepo.create({
        userId,
        assetId,
        amount,
      });
    }

    return this.balanceRepo.save(balance);
  }
}
