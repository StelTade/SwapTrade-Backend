import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { SwapHistory, SwapStatus } from './entities/swap-history.entity';
import { Balance } from '../balance/balance.entity';
import { SwapPricingService } from './swap-pricing.service';
import { CacheService } from '../common/services/cache.service';

const MAX_SETTLEMENT_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 500; // exponential back-off base

export interface SettlementResult {
  swapId: string;
  success: boolean;
  amountOut: number;
  executedRate: number;
  actualSlippage: number;
  settledAt: Date;
}

@Injectable()
export class SwapSettlementService {
  private readonly logger = new Logger(SwapSettlementService.name);

  constructor(
    @InjectRepository(SwapHistory)
    private readonly swapHistoryRepo: Repository<SwapHistory>,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
    private readonly pricingService: SwapPricingService,
    private readonly cacheService: CacheService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Main settlement entry point (called by the batch processor)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to settle a single pending swap with retry logic.
   * Uses exponential back-off between attempts.
   */
  async settle(
    swapId: string,
    manager: EntityManager,
  ): Promise<SettlementResult> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= MAX_SETTLEMENT_RETRIES) {
      try {
        const result = await this.attemptSettlement(swapId, manager);
        return result;
      } catch (err) {
        lastError = err as Error;
        attempt++;

        if (attempt > MAX_SETTLEMENT_RETRIES) break;

        this.logger.warn(
          `Settlement attempt ${attempt} failed for swap ${swapId}: ${err.message}. Retrying…`,
        );

        // Exponential back-off: 500ms, 1000ms, 2000ms
        await this.delay(RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1));

        // Update retry count in DB
        await this.swapHistoryRepo.update(swapId, {
          status: SwapStatus.RETRYING,
          retryCount: attempt,
        });
      }
    }

    // All retries exhausted — mark as failed
    await this.swapHistoryRepo.update(swapId, {
      status: SwapStatus.FAILED,
      errorMessage: lastError?.message ?? 'Unknown error',
      failureReason: 'Max settlement retries exceeded',
    });

    throw lastError ?? new Error('Settlement failed after max retries');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Single settlement attempt
  // ──────────────────────────────────────────────────────────────────────────

  private async attemptSettlement(
    swapId: string,
    manager: EntityManager,
  ): Promise<SettlementResult> {
    const swap = await manager.findOne(SwapHistory, {
      where: { id: swapId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!swap) throw new BadRequestException(`Swap ${swapId} not found`);

    if (
      swap.status === SwapStatus.COMPLETED ||
      swap.status === SwapStatus.FAILED
    ) {
      throw new BadRequestException(
        `Swap ${swapId} already in terminal state: ${swap.status}`,
      );
    }

    // Re-fetch live price and validate slippage hasn't breached tolerance
    const liveQuote = await this.pricingService.getQuote(
      swap.fromAsset,
      swap.toAsset,
      Number(swap.amountIn),
    );

    const { valid, actualSlippage } =
      await this.pricingService.validateSlippage(
        { ...liveQuote, rate: Number(swap.quotedRate) } as any,
        liveQuote.rate,
        Number(swap.slippageTolerance),
      );

    if (!valid) {
      await manager.update(SwapHistory, swapId, {
        status: SwapStatus.FAILED,
        actualSlippage,
        errorMessage: `Slippage ${(actualSlippage * 100).toFixed(3)}% exceeded tolerance ${(Number(swap.slippageTolerance) * 100).toFixed(3)}%`,
        failureReason: 'slippage_exceeded',
      });
      throw new BadRequestException('Slippage tolerance exceeded');
    }

    // Execute AMM swap (mutates pool state)
    const { amountOut, rate: executedRate } =
      this.pricingService.executeAmmSwap(
        swap.fromAsset,
        swap.toAsset,
        Number(swap.amountIn),
      );

    // Update balances inside the same transaction
    await this.updateBalances(
      manager,
      swap.userId,
      swap.fromAsset,
      swap.toAsset,
      Number(swap.amountIn),
      amountOut,
    );

    const settledAt = new Date();

    // Mark swap as completed
    await manager.update(SwapHistory, swapId, {
      status: SwapStatus.COMPLETED,
      amountOut,
      executedRate,
      actualSlippage,
      priceImpact: liveQuote.priceImpact,
      executedAt: settledAt,
      settledAt,
    });

    // Invalidate user balance caches
    await this.cacheService
      .invalidateBalanceRelatedCaches(swap.userId)
      .catch((e) => this.logger.warn(`Cache invalidation failed: ${e.message}`));

    this.logger.log(
      `Settled swap ${swapId}: ${swap.amountIn} ${swap.fromAsset} → ${amountOut.toFixed(8)} ${swap.toAsset} (slippage ${(actualSlippage * 100).toFixed(3)}%)`,
    );

    return {
      swapId,
      success: true,
      amountOut,
      executedRate,
      actualSlippage,
      settledAt,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Balance mutation
  // ──────────────────────────────────────────────────────────────────────────

  private async updateBalances(
    manager: EntityManager,
    userId: string,
    fromAsset: string,
    toAsset: string,
    amountIn: number,
    amountOut: number,
  ): Promise<void> {
    const balanceRepo = manager.getRepository(Balance);

    // Lock both rows to prevent concurrent mutation
    const [fromBalance, toBalance] = await Promise.all([
      balanceRepo.findOne({
        where: { userId, asset: fromAsset },
        lock: { mode: 'pessimistic_write' },
      }),
      balanceRepo.findOne({
        where: { userId, asset: toAsset },
        lock: { mode: 'pessimistic_write' },
      }),
    ]);

    if (!fromBalance || Number(fromBalance.balance) < amountIn) {
      throw new BadRequestException(
        `Insufficient ${fromAsset} balance during settlement`,
      );
    }

    fromBalance.balance = Number(fromBalance.balance) - amountIn;

    if (toBalance) {
      toBalance.balance = Number(toBalance.balance) + amountOut;
      await balanceRepo.save([fromBalance, toBalance]);
    } else {
      const newBalance = balanceRepo.create({
        userId,
        asset: toAsset,
        balance: amountOut,
      });
      await balanceRepo.save([fromBalance, newBalance]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Roll back a swap (release reserved funds back to user)
  // ──────────────────────────────────────────────────────────────────────────

  async rollback(swapId: string, manager: EntityManager): Promise<void> {
    const swap = await manager.findOne(SwapHistory, { where: { id: swapId } });
    if (!swap) return;

    // Restore the deducted amountIn back to the user
    const fromBalance = await manager.findOne(Balance, {
      where: { userId: swap.userId, asset: swap.fromAsset },
      lock: { mode: 'pessimistic_write' },
    });

    if (fromBalance) {
      fromBalance.balance = Number(fromBalance.balance) + Number(swap.amountIn);
      await manager.save(fromBalance);
    }

    await manager.update(SwapHistory, swapId, {
      status: SwapStatus.ROLLED_BACK,
      failureReason: 'atomic_batch_rollback',
    });

    this.logger.warn(`Rolled back swap ${swapId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}