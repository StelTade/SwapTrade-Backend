import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TradingBonus, BonusStatus, BONUS_TIERS } from './entities/trading-bonus.entity';
import { Trade, TradeStatus } from '../trading/entities/trade.entity';
import { BonusQueryDto } from './dto/trading-bonus.dto';

@Injectable()
export class TradingBonusesService {
  private readonly logger = new Logger(TradingBonusesService.name);

  constructor(
    @InjectRepository(TradingBonus)
    private readonly bonusRepo: Repository<TradingBonus>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Tier calculation (pure, testable)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Computes the bonus rate and amount for a given trading volume.
   * Tiers: <$1k → 0%, $1k–$10k → 1%, $10k–$100k → 2%, ≥$100k → 3%
   */
  computeBonus(tradingVolume: number): { bonusRate: number; bonusAmount: number } {
    for (const tier of BONUS_TIERS) {
      if (tradingVolume >= tier.minVolume) {
        return {
          bonusRate: tier.rate,
          bonusAmount: parseFloat((tradingVolume * tier.rate).toFixed(8)),
        };
      }
    }
    return { bonusRate: 0, bonusAmount: 0 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate and upsert the monthly trading bonus for a user.
   * Sums all EXECUTED trades for the user in the given month.
   */
  async calculateMonthlyBonus(userId: number, month: string): Promise<TradingBonus> {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);

    const trades = await this.tradeRepo.find({
      where: {
        userId,
        status: TradeStatus.EXECUTED,
        createdAt: Between(startDate, endDate),
      },
    });

    const tradingVolume = trades.reduce((sum, t) => sum + Number(t.totalValue), 0);
    const { bonusRate, bonusAmount } = this.computeBonus(tradingVolume);

    const existing = await this.bonusRepo.findOne({ where: { userId, month } });

    if (existing) {
      existing.tradingVolume = tradingVolume;
      existing.bonusAmount = bonusAmount;
      existing.bonusRate = bonusRate;
      existing.calculatedAt = new Date();
      return this.bonusRepo.save(existing);
    }

    const bonus = this.bonusRepo.create({
      userId,
      month,
      tradingVolume,
      bonusAmount,
      bonusRate,
      status: BonusStatus.PENDING,
      calculatedAt: new Date(),
    });

    return this.bonusRepo.save(bonus);
  }

  /**
   * Process all pending bonuses for a given month (automated monthly payout).
   */
  async processMonthlyPayouts(month: string): Promise<{ processed: number; totalPaid: number }> {
    const pending = await this.bonusRepo.find({
      where: { month, status: BonusStatus.PENDING },
    });

    let totalPaid = 0;
    let processed = 0;

    for (const bonus of pending) {
      if (bonus.bonusAmount > 0) {
        bonus.status = BonusStatus.PAID;
        bonus.paidAt = new Date();
        await this.bonusRepo.save(bonus);
        totalPaid += Number(bonus.bonusAmount);
        processed++;
        this.logger.log(`Bonus paid: userId=${bonus.userId} month=${month} amount=${bonus.bonusAmount}`);
      } else {
        // Zero-amount bonuses are cancelled (below minimum trading volume)
        bonus.status = BonusStatus.CANCELLED;
        await this.bonusRepo.save(bonus);
      }
    }

    this.logger.log(`Monthly payouts complete: month=${month} processed=${processed} total=$${totalPaid.toFixed(2)}`);
    return { processed, totalPaid };
  }

  /**
   * Get paginated bonus history for a user.
   */
  async getUserBonusHistory(userId: number, query: BonusQueryDto) {
    const { page = 1, limit = 20, month } = query;
    const qb = this.bonusRepo
      .createQueryBuilder('b')
      .where('b.userId = :userId', { userId })
      .orderBy('b.month', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (month) qb.andWhere('b.month = :month', { month });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Admin: summary stats for a given month.
   */
  async getBonusSummary(month: string) {
    const bonuses = await this.bonusRepo.find({ where: { month } });

    const summary = {
      month,
      totalBonuses: bonuses.length,
      totalBonusAmount: bonuses.reduce((s, b) => s + Number(b.bonusAmount), 0),
      totalTradingVolume: bonuses.reduce((s, b) => s + Number(b.tradingVolume), 0),
      byStatus: {
        [BonusStatus.PENDING]: bonuses.filter(b => b.status === BonusStatus.PENDING).length,
        [BonusStatus.PAID]: bonuses.filter(b => b.status === BonusStatus.PAID).length,
        [BonusStatus.CANCELLED]: bonuses.filter(b => b.status === BonusStatus.CANCELLED).length,
      },
    };

    return summary;
  }
}
