import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MoreThan, Repository } from 'typeorm';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { WalletException } from '../exceptions/wallet.exception';

/**
 * Per-user withdrawal rate limits, enforced against persisted
 * {@link WithdrawalRequest} history. These are value/velocity caps keyed on the
 * authenticated user — something IP-based `@nestjs/throttler` cannot express.
 */
@Injectable()
export class WalletRateLimitService {
  private readonly maxPerHour: number;
  private readonly maxDailyValue: number;

  /** Statuses whose funds were released, so they don't count toward daily value. */
  private static readonly RELEASED_STATUSES = [
    WithdrawalStatus.REJECTED,
    WithdrawalStatus.CANCELLED,
    WithdrawalStatus.FAILED,
  ];

  constructor(
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    private readonly configService: ConfigService,
  ) {
    this.maxPerHour = this.configService.get<number>(
      'WALLET_WITHDRAWAL_MAX_PER_HOUR',
      5,
    );
    this.maxDailyValue = this.configService.get<number>(
      'WALLET_WITHDRAWAL_MAX_DAILY_VALUE',
      10000,
    );
  }

  /**
   * Throws {@link WalletException.rateLimited} if allowing a new withdrawal of
   * `amount` would exceed either the hourly count or the rolling 24h value cap.
   */
  async assertWithinLimits(userId: string, amount: number): Promise<void> {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const recentCount = await this.withdrawalRepo.count({
      where: { userId, createdAt: MoreThan(oneHourAgo) },
    });
    if (recentCount >= this.maxPerHour) {
      throw WalletException.rateLimited(
        `Withdrawal rate limit exceeded: at most ${this.maxPerHour} per hour`,
      );
    }

    const raw = await this.withdrawalRepo
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amount), 0)', 'sum')
      .where('w.userId = :userId', { userId })
      .andWhere('w.createdAt > :since', { since: oneDayAgo })
      .andWhere('w.status NOT IN (:...released)', {
        released: WalletRateLimitService.RELEASED_STATUSES,
      })
      .getRawOne<{ sum: string }>();

    const dailyTotal = Number(raw?.sum ?? 0) + amount;
    if (dailyTotal > this.maxDailyValue) {
      throw WalletException.rateLimited(
        `Daily withdrawal value limit exceeded: at most ${this.maxDailyValue} per 24h`,
      );
    }
  }
}
