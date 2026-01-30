import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceAudit } from './balance-audit.entity';
import {
  BalanceHistoryQueryDto,
  BalanceHistoryResponseDto,
  BalanceHistoryEntryDto,
} from './dto/balance-history.dto';
import {
  GetUserBalancesDto,
  GetUserBalancesResponseDto,
} from './dto/get-user-balances.dto';
import { PaginationQueryDto } from '../common/interfaces/pagination.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../common/services/cache.service';
import { UserBalance } from './user-balance.entity';
import { UpdateBalanceDto } from './dto/update-balance.dto';
import { CacheKey, InvalidateCacheKeys } from '../common/decorators/cache-key.decorator';
import { CacheTTL } from '../common/decorators/cache.decorators';

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
    private readonly cacheService: CacheService,
  ) {}

  private readonly USER_BALANCE_CACHE_TTL = 30; // 30 seconds

  @CacheKey('user:balance:{{userId}}')
  @CacheTTL(30)
  async getUserBalances(
    userId: string,
    pagination?: PaginationQueryDto,
  ): Promise<GetUserBalancesResponseDto | Array<{ asset: string; balance: number }>> {
    // Handle backward compatibility: if no pagination provided, return simple array
    if (!pagination) {
      try {
        const cached = await this.cacheService.getUserBalanceCache(userId);
        if (cached) {
          return cached;
        }
      } catch (error) {
        console.warn(
          'Cache unavailable, falling back to database:',
          error.message,
        );
      }

      const balances = await this.balanceRepository.find({
        where: { userId },
      });
      const result = balances.map((b) => ({
        asset: b.asset,
        balance: b.balance,
      }));

      try {
        await this.cacheService.setUserBalanceCache(userId, result);
      } catch (error) {
        console.warn('Failed to cache result:', error.message);
      }

      return result;
    }

    // Paginated response
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = pagination.offset || 0;

    if (offset < 0) {
      throw new BadRequestException('Offset cannot be negative');
    }

    const [balances, total] = await this.balanceRepository.findAndCount({
      where: { userId },
      skip: offset,
      take: limit,
      order: { asset: 'ASC' },
    });

    const data: GetUserBalancesDto[] = balances.map((b) => ({
      asset: b.asset,
      balance: b.balance,
    }));

    return new GetUserBalancesResponseDto(data, total, limit, offset);
  }

  async getBalance(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserBalance> {
    const repo = (manager ?? this.dataSource.manager).getRepository(
      UserBalance,
    );

    let balance = await repo.findOne({ where: { userId } });
    if (!balance) {
      balance = repo.create({ userId, amount: 0 });
      await repo.save(balance);
    }
    return balance;
  }

  async getAvailableBalance(
    userId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const balance = await this.getBalance(userId, manager);
    return Number(balance.amount ?? 0);
  }

  /** Add a balance audit entry */
  async getBalanceHistory(
    userId: string,
    query: BalanceHistoryQueryDto,
  ): Promise<BalanceHistoryResponseDto> {
    const limit = Math.min(query.limit || 20, 100);
    const offset = query.offset || 0;

    const [entries, total] = await this.balanceAuditRepository.findAndCount({
      where: { userId },
      order: { timestamp: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data: BalanceHistoryEntryDto[] = entries.map((e) => ({
      asset: e.asset,
      amountChanged: e.amountChanged,
      resultingBalance: e.resultingBalance,
      reason: e.reason,
      timestamp: e.timestamp?.toISOString() || new Date().toISOString(),
      transactionId: e.transactionId,
      relatedOrderId: e.relatedOrderId,
    }));

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
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

    const savedEntry = await this.balanceAuditRepository.save(auditEntry);

    // Invalidate user balance cache since balance has changed
    await this.cacheService.invalidateBalanceRelatedCaches(userId);

    return savedEntry;
  }

  /**
   * Atomically update user's balance
   */
  async updateUserBalance(dto: UpdateBalanceDto): Promise<number> {
    const { userId, assetId, amount, reason, transactionId, relatedOrderId } =
      dto;

    if (!userId || !assetId)
      throw new BadRequestException('Invalid userId or assetId');
    if (amount === undefined || isNaN(amount))
      throw new BadRequestException('Invalid amount');
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

  async reserveFunds(
    userId: string,
    amount: number,
    reason: string,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(UserBalance);

    const balance = await repo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance || Number(balance.amount ?? 0) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    balance.amount = Number(balance.amount ?? 0) - amount;
    await repo.save(balance);
  }

  async releaseFunds(
    userId: string,
    amount: number,
    reason: string,
    manager: EntityManager,
  ) {
    const repo = manager.getRepository(UserBalance);

    const balance = await repo.findOne({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) {
      throw new BadRequestException('User balance not found');
    }

    balance.amount = Number(balance.amount ?? 0) + amount;
    await repo.save(balance);
  }
}
