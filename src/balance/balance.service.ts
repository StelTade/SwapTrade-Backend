import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceAudit } from './balance-audit.entity';
import { UserBalance } from './user-balance.entity';
import { UpdateBalanceDto } from './dto/update-balance.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(BalanceAudit)
    private readonly balanceAuditRepository: Repository<BalanceAudit>,
    @InjectRepository(UserBalance)
    private readonly userBalanceRepository: Repository<UserBalance>,
    private readonly dataSource: DataSource,
  ) {}

  /** Get all balances for a user */
  async getUserBalances(userId: string): Promise<Array<{ asset: string; balance: number }>> {
    const balances = await this.balanceRepository.find({ where: { userId } });
    return balances.map((b) => ({ asset: b.asset, balance: b.balance }));
  }

  /** Add a balance audit entry */
  async addBalanceAuditEntry(
    userId: string,
    asset: string,
    amountChanged: number,
    resultingBalance: number,
    reason: string,
    transactionId?: string,
    relatedOrderId?: string,
    previousBalance?: number,
  ): Promise<BalanceAudit> {
    const auditEntry = this.balanceAuditRepository.create({
      userId,
      asset,
      amountChanged,
      resultingBalance,
      reason,
      transactionId,
      relatedOrderId,
      previousBalance,
    });

    return this.balanceAuditRepository.save(auditEntry);
  }

  /**
   * Atomically update user's balance
   */
  async updateUserBalance(dto: UpdateBalanceDto): Promise<number> {
    const { userId, assetId, amount, reason, transactionId, relatedOrderId } = dto;

    if (!userId || !assetId) throw new BadRequestException('Invalid userId or assetId');
    if (amount === undefined || isNaN(amount)) throw new BadRequestException('Invalid amount');
    if (!reason) throw new BadRequestException('Reason is required');

    return await this.dataSource.transaction(async (manager) => {
      // Lock row for concurrency safety
      let userBalance: UserBalance | null = await manager.findOne(UserBalance, {
        where: { userId: userId.toString(), assetId: assetId.toString() },
        lock: { mode: 'pessimistic_write' },
      });

      const previousBalance = Number(userBalance?.amount ?? 0);
      const newBalance = previousBalance + amount;

      if (newBalance < 0) throw new BadRequestException('Insufficient balance');

      // Update or create balance
      if (userBalance) {
        userBalance.amount = newBalance;
      } else {
        userBalance = manager.create(UserBalance, {
          userId: userId.toString(),
          assetId: assetId.toString(),
        });
      }

      await manager.save(userBalance);

      // Create audit entry
      const audit = manager.create(BalanceAudit, {
        userId: userId.toString(), // BalanceAudit.userId is string
        asset: assetId.toString(),
        previousBalance,
        resultingBalance: newBalance,
        amountChanged: amount,
        reason,
        transactionId,
        relatedOrderId,
      });

      await manager.save(audit);

      return newBalance;
    });
  }
}
