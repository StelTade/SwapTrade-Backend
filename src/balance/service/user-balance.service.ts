import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBalance } from '../entities/user-balance.entity';

@Injectable()
export class UserBalanceService {
  constructor(
    @InjectRepository(UserBalance)
    private readonly balanceRepo: Repository<UserBalance>,
  ) {}

  async addBalance(userId: number, assetId: number, amount: number) {
    let balance = await this.balanceRepo.findOne({
      where: { userId, assetId },
      relations: ['user', 'asset'], // Eager load user and virtual asset
    });

    if (balance) {
      balance.balance = Number(balance.balance) + amount;
      balance.totalInvested = Number(balance.totalInvested || 0) + amount; // Assuming deposit counts as investment
    } else {
      balance = this.balanceRepo.create({
        userId,
        assetId,
        balance: amount,
        totalInvested: amount,
        cumulativePnL: 0,
        averageBuyPrice: 0,
      });
    }

    return this.balanceRepo.save(balance);
  }

  // Alias for addBalance to be used by controller
  async deposit(userId: number, assetId: number, amount: number) {
      return this.addBalance(userId, assetId, amount);
  }

  async getUserBalances(userId: number) {
    const balances = await this.balanceRepo.find({
      where: { userId },
      relations: ['asset'],
    });
    return balances.map((b) => ({
      asset: b.asset.symbol,
      balance: Number(b.balance),
      assetId: b.asset.id,
      totalInvested: Number(b.totalInvested),
      totalPnL: Number(b.cumulativePnL),
    }));
  }

  async withdraw(userId: number, assetId: number, amount: number) {
    const balance = await this.balanceRepo.findOne({
      where: { userId, assetId },
    });

    if (!balance || Number(balance.balance) < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    balance.balance = Number(balance.balance) - amount;
    return this.balanceRepo.save(balance);
  }
}
