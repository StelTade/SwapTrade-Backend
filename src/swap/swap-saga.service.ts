import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SwapHistory, SwapStatus, SwapType } from './entities/swap-history.entity';
import { SwapPricingService, PriceQuote } from './swap-pricing.service';
import { SwapSettlementService } from './swap-settlement.service';
import { Balance } from '../balance/balance.entity';

export interface SagaStep {
  swapId: string;
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  quote: PriceQuote;
  status: 'pending' | 'completed' | 'compensated';
}

export interface SagaResult {
  batchId: string;
  steps: SagaStep[];
  success: boolean;
  totalAmountOut: number;
  finalAsset: string;
}

@Injectable()
export class SwapSagaService {
  private readonly logger = new Logger(SwapSagaService.name);

  constructor(
    @InjectRepository(SwapHistory)
    private readonly swapHistoryRepo: Repository<SwapHistory>,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
    private readonly dataSource: DataSource,
    private readonly pricingService: SwapPricingService,
    private readonly settlementService: SwapSettlementService,
  ) {}

  /**
   * Execute a multi-leg swap as a saga.
   * Each leg is a separate swap; on any failure, completed legs are compensated.
   *
   * Example: USDT → ETH → BTC
   * Leg 1: USDT → ETH
   * Leg 2: ETH  → BTC
   */
  async executeMultiLegSwap(
    userId: string,
    route: string[],
    amountIn: number,
    slippageTolerance: number,
    batchId?: string,
  ): Promise<SagaResult> {
    if (route.length < 2) {
      throw new BadRequestException('Route must have at least 2 assets');
    }

    const sagaBatchId = batchId ?? uuidv4();
    const steps: SagaStep[] = [];

    // ── Phase 1: Quote all legs upfront ────────────────────────────────────
    let currentAmount = amountIn;
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to   = route[i + 1];
      const quote = await this.pricingService.getQuote(from, to, currentAmount);

      steps.push({
        swapId: uuidv4(),
        fromAsset: from,
        toAsset: to,
        amountIn: currentAmount,
        quote,
        status: 'pending',
      });

      currentAmount = quote.amountOut;
    }

    // ── Phase 2: Persist all swap records ──────────────────────────────────
    const swapRecords = steps.map((step) =>
      this.swapHistoryRepo.create({
        id: step.swapId,
        userId,
        fromAsset: step.fromAsset,
        toAsset: step.toAsset,
        amountIn: step.amountIn,
        quotedRate: step.quote.rate,
        slippageTolerance,
        status: SwapStatus.PENDING,
        swapType: SwapType.MULTI_LEG,
        batchId: sagaBatchId,
        route,
      }),
    );
    await this.swapHistoryRepo.save(swapRecords);

    // ── Phase 3: Execute legs sequentially inside a transaction ────────────
    try {
      await this.dataSource.transaction(async (manager) => {
        for (const step of steps) {
          await manager.update(SwapHistory, step.swapId, {
            status: SwapStatus.PROCESSING,
          });

          await this.settlementService.settle(step.swapId, manager);
          step.status = 'completed';

          this.logger.debug(
            `Saga ${sagaBatchId}: leg ${step.fromAsset}→${step.toAsset} completed`,
          );
        }
      });
    } catch (err) {
      this.logger.error(
        `Saga ${sagaBatchId} failed: ${err.message}. Running compensation…`,
      );

      // ── Compensation: roll back completed legs in reverse order ──────────
      await this.compensate(steps, sagaBatchId);

      throw new BadRequestException(
        `Multi-leg swap failed and was rolled back: ${err.message}`,
      );
    }

    const finalStep = steps[steps.length - 1];

    return {
      batchId: sagaBatchId,
      steps,
      success: true,
      totalAmountOut: finalStep.quote.amountOut,
      finalAsset: finalStep.toAsset,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Compensation (reverse order rollback)
  // ──────────────────────────────────────────────────────────────────────────

  private async compensate(steps: SagaStep[], batchId: string): Promise<void> {
    const completedSteps = steps
      .filter((s) => s.status === 'completed')
      .reverse();

    for (const step of completedSteps) {
      try {
        await this.dataSource.transaction(async (manager) => {
          await this.settlementService.rollback(step.swapId, manager);
          step.status = 'compensated';
          this.logger.log(
            `Compensated leg ${step.fromAsset}→${step.toAsset} in saga ${batchId}`,
          );
        });
      } catch (compensationErr) {
        // Log compensation failure but don't re-throw — record it for manual review
        this.logger.error(
          `CRITICAL: Compensation failed for swap ${step.swapId} in saga ${batchId}: ${compensationErr.message}`,
        );
        await this.swapHistoryRepo.update(step.swapId, {
          errorMessage: `Compensation failed: ${compensationErr.message}`,
          failureReason: 'compensation_failed_needs_manual_review',
        });
      }
    }
  }
}