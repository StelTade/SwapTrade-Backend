import {
  Processor,
  Process,
  OnQueueError,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job } from 'bull';
import { QueueName } from '../queue/queue.constants';
import { SwapHistory, SwapStatus, SwapType } from './entities/swap-history.entity';
import { SwapSettlementService } from './swap-settlement.service';
import { SwapSagaService } from './swap-saga.service';
import { SwapPricingService } from './swap-pricing.service';

// ── Job payload types ────────────────────────────────────────────────────────

export interface SingleSwapJobData {
  type: 'single';
  swapId: string;
  userId: string;
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  slippageTolerance: number;
  quotedRate: number;
}

export interface MultiLegSwapJobData {
  type: 'multi_leg';
  batchId: string;
  userId: string;
  route: string[];
  amountIn: number;
  slippageTolerance: number;
}

export interface BatchSwapJobData {
  type: 'batch';
  batchId: string;
  userId: string;
  atomic: boolean;
  swapIds: string[]; // pre-created SwapHistory IDs
}

export type SwapJobData =
  | SingleSwapJobData
  | MultiLegSwapJobData
  | BatchSwapJobData;

// ── Processor ────────────────────────────────────────────────────────────────

@Processor(QueueName.SWAPS)
export class SwapBatchProcessor {
  private readonly logger = new Logger(SwapBatchProcessor.name);

  constructor(
    @InjectRepository(SwapHistory)
    private readonly swapHistoryRepo: Repository<SwapHistory>,
    private readonly dataSource: DataSource,
    private readonly settlementService: SwapSettlementService,
    private readonly sagaService: SwapSagaService,
    private readonly pricingService: SwapPricingService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Job handlers
  // ──────────────────────────────────────────────────────────────────────────

  @Process('single')
  async processSingleSwap(job: Job<SingleSwapJobData>): Promise<void> {
    const { swapId, userId } = job.data;
    this.logger.log(`Processing single swap job ${job.id} → swapId=${swapId}`);

    await this.swapHistoryRepo.update(swapId, {
      status: SwapStatus.PROCESSING,
      jobId: String(job.id),
    });

    await this.dataSource.transaction(async (manager) => {
      await this.settlementService.settle(swapId, manager);
    });
  }

  @Process('multi_leg')
  async processMultiLegSwap(job: Job<MultiLegSwapJobData>): Promise<void> {
    const { batchId, userId, route, amountIn, slippageTolerance } = job.data;
    this.logger.log(`Processing multi-leg swap job ${job.id} → batchId=${batchId}`);

    await this.sagaService.executeMultiLegSwap(
      userId,
      route,
      amountIn,
      slippageTolerance,
      batchId,
    );
  }

  @Process('batch')
  async processBatchSwap(job: Job<BatchSwapJobData>): Promise<void> {
    const { batchId, swapIds, atomic } = job.data;
    this.logger.log(
      `Processing batch job ${job.id} → batchId=${batchId}, ${swapIds.length} swaps, atomic=${atomic}`,
    );

    if (atomic) {
      await this.processAtomicBatch(batchId, swapIds, job);
    } else {
      await this.processBestEffortBatch(batchId, swapIds, job);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Batch strategies
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Atomic batch: all swaps succeed or all are rolled back.
   * Runs inside a single transaction.
   */
  private async processAtomicBatch(
    batchId: string,
    swapIds: string[],
    job: Job,
  ): Promise<void> {
    const settled: string[] = [];

    try {
      await this.dataSource.transaction(async (manager) => {
        for (const swapId of swapIds) {
          await manager.update(SwapHistory, swapId, {
            status: SwapStatus.PROCESSING,
            jobId: String(job.id),
          });

          await this.settlementService.settle(swapId, manager);
          settled.push(swapId);
        }
      });

      this.logger.log(
        `Atomic batch ${batchId}: all ${swapIds.length} swaps settled`,
      );
    } catch (err) {
      this.logger.error(
        `Atomic batch ${batchId} failed at swap count ${settled.length}: ${err.message}`,
      );

      // Roll back any that completed before the transaction failed
      await this.dataSource.transaction(async (manager) => {
        for (const swapId of settled) {
          await this.settlementService.rollback(swapId, manager);
        }
      });

      // Mark remaining as failed
      const unsettled = swapIds.filter((id) => !settled.includes(id));
      if (unsettled.length > 0) {
        await this.swapHistoryRepo.update(unsettled, {
          status: SwapStatus.FAILED,
          failureReason: 'atomic_batch_aborted',
          errorMessage: err.message,
        });
      }

      throw err; // Re-throw so Bull marks the job as failed
    }
  }

  /**
   * Best-effort batch: each swap is attempted independently.
   * Failures don't affect other swaps in the batch.
   */
  private async processBestEffortBatch(
    batchId: string,
    swapIds: string[],
    job: Job,
  ): Promise<void> {
    const results = await Promise.allSettled(
      swapIds.map(async (swapId) => {
        await this.swapHistoryRepo.update(swapId, {
          status: SwapStatus.PROCESSING,
          jobId: String(job.id),
        });

        return this.dataSource.transaction((manager) =>
          this.settlementService.settle(swapId, manager),
        );
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed    = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(
      `Best-effort batch ${batchId}: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queue event hooks
  // ──────────────────────────────────────────────────────────────────────────

  @OnQueueError()
  onError(error: Error): void {
    this.logger.error(`Swap queue error: ${error.message}`, error.stack);
  }

  @OnQueueFailed()
  async onFailed(job: Job<SwapJobData>, error: Error): Promise<void> {
    this.logger.error(
      `Swap job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );

    // Mark the associated swap(s) as failed in the DB
    try {
      if (job.data.type === 'single') {
        await this.swapHistoryRepo.update(job.data.swapId, {
          status: SwapStatus.FAILED,
          errorMessage: error.message,
          failureReason: 'job_exhausted_retries',
        });
      } else if (job.data.type === 'batch') {
        // Only mark swaps still in PROCESSING state as failed
        // (completed ones were already marked by the settlement service)
        await this.swapHistoryRepo
          .createQueryBuilder()
          .update()
          .set({
            status: SwapStatus.FAILED,
            errorMessage: error.message,
            failureReason: 'batch_job_failed',
          })
          .where('batchId = :batchId AND status = :status', {
            batchId: job.data.batchId,
            status: SwapStatus.PROCESSING,
          })
          .execute();
      }
    } catch (dbErr) {
      this.logger.error(
        `Failed to update swap status after job failure: ${dbErr.message}`,
      );
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Swap job ${job.id} completed in ${Date.now() - job.timestamp}ms`);
  }
}