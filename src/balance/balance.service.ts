import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceAudit } from './balance-audit.entity';
import { BalanceHistoryQueryDto, BalanceHistoryResponseDto, BalanceHistoryEntryDto } from './dto/balance-history.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(BalanceAudit)
    private readonly balanceAuditRepository: Repository<BalanceAudit>,
  ) {}

  async getUserBalances(
    userId: string,
  ): Promise<Array<{ asset: string; balance: number }>> {
    const balances = await this.balanceRepository.find({ 
      where: { userId },
    });
    return balances.map((b) => ({ asset: b.asset, balance: b.balance }));
  }

  async getBalanceHistory(
    userId: string,
    query: BalanceHistoryQueryDto,
  ): Promise<BalanceHistoryResponseDto> {
    const { startDate, endDate, asset, limit = 50, offset = 0 } = query;

    // Build query conditions
    const whereConditions: any = { userId };

    if (asset) {
      whereConditions.asset = asset;
    }

    if (startDate && endDate) {
      whereConditions.timestamp = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      whereConditions.timestamp = MoreThan(new Date(startDate));
    } else if (endDate) {
      whereConditions.timestamp = LessThan(new Date(endDate));
    }

    // Get total count for pagination
    const total = await this.balanceAuditRepository.count({
      where: whereConditions,
    });

    // Get paginated results
    const auditEntries = await this.balanceAuditRepository.find({
      where: whereConditions,
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Transform to response format
    const data: BalanceHistoryEntryDto[] = auditEntries.map((entry) => ({
      asset: entry.asset,
      amountChanged: entry.amountChanged,
      reason: entry.reason,
      timestamp: entry.timestamp.toISOString(),
      resultingBalance: entry.resultingBalance,
      transactionId: entry.transactionId,
      relatedOrderId: entry.relatedOrderId,
    }));

    const hasMore = offset + limit < total;

    return {
      data,
      total,
      limit,
      offset,
      hasMore,
    };
  }

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
}
