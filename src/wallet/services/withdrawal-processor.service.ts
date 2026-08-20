import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';
import { WalletLedgerService } from './wallet-ledger.service';
import { BroadcasterRegistry } from './broadcasters/broadcaster.registry';

/**
 * Cron-driven engine that advances withdrawals through their on-chain states:
 *  - `processQueued` claims QUEUED rows atomically, broadcasts them, and marks
 *    them SENT (or FAILED, releasing the reservation);
 *  - `confirmSent` polls SENT rows and, once confirmed, debits the reservation
 *    exactly once and marks them COMPLETED.
 *
 * Concurrency safety comes from conditional `UPDATE ... WHERE status = ?`
 * claims (so two ticks can't both process a row) plus an idempotent
 * reserved-debit keyed on the withdrawal id.
 */
@Injectable()
export class WithdrawalProcessorService {
  private readonly logger = new Logger(WithdrawalProcessorService.name);

  constructor(
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    private readonly ledger: WalletLedgerService,
    private readonly broadcasters: BroadcasterRegistry,
    private readonly events: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  /** Broadcast queued withdrawals. Each row is claimed atomically first. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processQueued(): Promise<void> {
    const queued = await this.withdrawalRepo.find({
      where: { status: WithdrawalStatus.QUEUED },
      order: { createdAt: 'ASC' },
      take: 25,
    });
    for (const row of queued) {
      const claimed = await this.claim(row.id);
      if (claimed) await this.broadcastOne(claimed);
    }
  }

  /** Poll sent withdrawals and finalize those that reached confirmations. */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async confirmSent(): Promise<void> {
    const sent = await this.withdrawalRepo.find({
      where: { status: WithdrawalStatus.SENT },
      order: { createdAt: 'ASC' },
      take: 50,
    });
    for (const row of sent) {
      await this.confirmOne(row);
    }
  }

  // ─── internals ────────────────────────────────────────────────────────

  /** Atomically move QUEUED → PROCESSING; returns the row iff we won the claim. */
  private async claim(id: string): Promise<WithdrawalRequest | null> {
    const result = await this.withdrawalRepo.update(
      { id, status: WithdrawalStatus.QUEUED },
      { status: WithdrawalStatus.PROCESSING },
    );
    if (!result.affected) return null; // another tick claimed it first
    return this.withdrawalRepo.findOne({ where: { id } });
  }

  private async broadcastOne(withdrawal: WithdrawalRequest): Promise<void> {
    withdrawal.attempts += 1;
    try {
      const broadcaster = this.broadcasters.resolve(withdrawal.network);
      const result = await broadcaster.send(withdrawal.network, {
        userId: withdrawal.userId,
        toAddress: withdrawal.toAddress,
        amount: String(withdrawal.amount),
        asset: withdrawal.asset,
        memo: withdrawal.memo,
      });

      withdrawal.txHash = result.txHash;
      withdrawal.blockchainTxId = result.blockchainTxId ?? null;
      withdrawal.status = WithdrawalStatus.SENT;
      await this.withdrawalRepo.save(withdrawal);

      this.events.emit('wallet.withdrawal.sent', {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        txHash: withdrawal.txHash,
        network: withdrawal.network,
      });
      this.logger.log(
        `Withdrawal ${withdrawal.id} broadcast → SENT (tx ${withdrawal.txHash})`,
      );
    } catch (err) {
      withdrawal.status = WithdrawalStatus.FAILED;
      withdrawal.errorMessage = err?.message ?? 'broadcast failed';
      await this.withdrawalRepo.save(withdrawal);

      // Broadcast failed before funds left the platform → release the hold.
      await this.ledger
        .release(
          withdrawal.userId,
          withdrawal.asset,
          Number(withdrawal.amount),
          {
            referenceType: 'withdrawal',
            referenceId: withdrawal.id,
            metadata: { reason: 'broadcast_failed' },
          },
        )
        .catch((e) =>
          this.logger.error(
            `Failed to release reservation for ${withdrawal.id}: ${e.message}`,
          ),
        );

      this.events.emit('wallet.withdrawal.failed', {
        withdrawalId: withdrawal.id,
        userId: withdrawal.userId,
        error: withdrawal.errorMessage,
      });
      this.logger.error(
        `Withdrawal ${withdrawal.id} broadcast failed: ${withdrawal.errorMessage}`,
      );
    }
  }

  private async confirmOne(withdrawal: WithdrawalRequest): Promise<void> {
    if (!withdrawal.txHash) return;
    try {
      const confirmations = await this.broadcasters
        .resolve(withdrawal.network)
        .getConfirmations(withdrawal.network, withdrawal.txHash);

      const threshold = this.thresholdFor(withdrawal.network);
      if (confirmations < threshold) {
        // Not yet final — persist the latest confirmation count and wait.
        withdrawal.confirmations = confirmations;
        await this.withdrawalRepo.save(withdrawal);
        return;
      }

      // Debit the reservation first (idempotent), then flip to COMPLETED. If we
      // crash between the two, the row stays SENT and the next tick heals it:
      // the debit no-ops on its idempotency key and the flip completes.
      await this.ledger.debitReserved(
        withdrawal.userId,
        withdrawal.asset,
        Number(withdrawal.amount),
        {
          referenceType: 'withdrawal',
          referenceId: withdrawal.id,
          idempotencyKey: `withdrawal-debit:${withdrawal.id}`,
          metadata: { txHash: withdrawal.txHash },
        },
      );

      const result = await this.withdrawalRepo.update(
        { id: withdrawal.id, status: WithdrawalStatus.SENT },
        { status: WithdrawalStatus.COMPLETED, confirmations },
      );
      if (result.affected) {
        this.events.emit('wallet.withdrawal.completed', {
          withdrawalId: withdrawal.id,
          userId: withdrawal.userId,
          txHash: withdrawal.txHash,
        });
        this.logger.log(`Withdrawal ${withdrawal.id} confirmed → COMPLETED`);
      }
    } catch (err) {
      this.logger.warn(
        `Confirm check failed for withdrawal ${withdrawal.id}: ${err?.message}`,
      );
    }
  }

  /** Per-network confirmation threshold (mirrors the deposit connectors). */
  private thresholdFor(network: BlockchainNetwork): number {
    switch (network) {
      case BlockchainNetwork.STELLAR:
        return this.configService.get<number>('STELLAR_CONFIRMATIONS', 1);
      case BlockchainNetwork.ETHEREUM:
        return this.configService.get<number>('ETHEREUM_CONFIRMATIONS', 12);
      case BlockchainNetwork.BSC:
        return this.configService.get<number>('BSC_CONFIRMATIONS', 15);
      default:
        return 1;
    }
  }
}
