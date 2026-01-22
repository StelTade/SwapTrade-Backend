import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  async getUserBalances(
    userId: string,
  ): Promise<Array<{ asset: string; balance: number }>> {
    const balances = await this.balanceRepository.find({ 
      where: { userId },
    });
    return balances.map((b) => ({ asset: b.asset, balance: b.balance }));
  }
}
