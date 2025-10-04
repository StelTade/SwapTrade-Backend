import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeEntity } from './entities/trade.entity';
import { PortfolioAnalytics } from 'src/common/interfaces/portfolio.interface';


@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
  ) {}

  /**
   * Get analytics for a user's portfolio.
   * Calculates:
   * - Profit & Loss (PnL)
   * - Asset distribution
   * - Simple risk score
   */
  async getAnalytics(userId: string): Promise<PortfolioAnalytics> {
    const trades = await this.tradeRepo.find({ where: { userId } });

    if (!trades.length) {
      return { pnl: 0, assetDistribution: {}, riskScore: 0 };
    }

    let pnl = 0;
    const assetValues: Record<string, { bought: number; sold: number }> = {};

    for (const trade of trades) {
      if (!assetValues[trade.asset]) {
        assetValues[trade.asset] = { bought: 0, sold: 0 };
      }

      const tradeValue = trade.quantity * Number(trade.price);

      if (trade.side === 'BUY') {
        assetValues[trade.asset].bought += tradeValue;
        pnl -= tradeValue;
      } else if (trade.side === 'SELL') {
        assetValues[trade.asset].sold += tradeValue;
        pnl += tradeValue;
      }
    }

    // ✅ Asset Distribution (percentage of each asset)
    const totalValue = Object.values(assetValues)
      .reduce((sum, a) => sum + Math.max(a.sold, a.bought), 0);

    const assetDistribution: Record<string, number> = {};
    for (const [asset, value] of Object.entries(assetValues)) {
      assetDistribution[asset] =
        ((Math.max(value.sold, value.bought) / totalValue) * 100);
    }

    // ✅ Risk Score (standard deviation of asset allocation)
    const allocations = Object.values(assetDistribution);
    const mean =
      allocations.reduce((a, b) => a + b, 0) / allocations.length || 0;
    const variance =
      allocations.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) /
      allocations.length || 0;
    const riskScore = Math.sqrt(variance);

    return { pnl, assetDistribution, riskScore };
  }
}
