import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BlockchainTransaction,
  BlockchainNetwork,
  TransactionType,
  TransactionStatus,
} from '../../blockchain/entities/blockchain-transaction.entity';
import { WalletAddress } from '../../blockchain/entities/wallet-address.entity';
import { StellarService } from '../../blockchain/services/stellar.service';
import { EthereumService } from '../../blockchain/services/ethereum.service';
import { WalletLedgerService, LedgerBalance } from './wallet-ledger.service';
import { WalletException } from '../exceptions/wallet.exception';

/** Outcome of verifying (and possibly crediting) a deposit. */
export interface DepositResult {
  transaction: BlockchainTransaction;
  /** True if this call resulted in (or confirmed) a ledger credit. */
  credited: boolean;
  balance?: LedgerBalance;
}

/**
 * Owns the deposit side of the wallet: resolving deposit addresses, verifying
 * on-chain deposits through the blockchain connectors, and crediting the real-
 * funds ledger once a deposit reaches its per-chain confirmation threshold.
 *
 * Crediting is idempotent — keyed on `deposit:<network>:<txHash>` in the ledger
 * — so the HTTP verify path and the reconcile cron can both run without ever
 * double-crediting (acceptance criterion #1).
 */
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly stellarService: StellarService,
    private readonly ethereumService: EthereumService,
    private readonly ledger: WalletLedgerService,
    private readonly events: EventEmitter2,
    @InjectRepository(BlockchainTransaction)
    private readonly txRepo: Repository<BlockchainTransaction>,
  ) {}

  /** Deposit address for the user on `network` (created on first use). */
  async getDepositAddress(
    userId: string,
    network: BlockchainNetwork,
  ): Promise<WalletAddress> {
    if (network === BlockchainNetwork.STELLAR) {
      return this.stellarService.getOrCreateWallet(userId);
    }
    if (this.isEvm(network)) {
      return this.ethereumService.getOrCreateWallet(userId, network);
    }
    throw WalletException.unsupportedNetwork(network);
  }

  /** A user's on-chain deposit history across all networks, newest first. */
  async listUserDeposits(userId: string): Promise<BlockchainTransaction[]> {
    return this.txRepo.find({
      where: { userId, type: TransactionType.DEPOSIT },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Verify a deposit tx via the chain connector and credit the ledger when the
   * transaction is confirmed. Safe to call repeatedly for the same tx.
   */
  async verifyAndCreditDeposit(
    userId: string,
    network: BlockchainNetwork,
    txHash: string,
  ): Promise<DepositResult> {
    const tx = await this.verifyViaConnector(userId, network, txHash);
    return this.creditIfConfirmed(tx);
  }

  private isEvm(network: BlockchainNetwork): boolean {
    return (
      network === BlockchainNetwork.ETHEREUM ||
      network === BlockchainNetwork.BSC
    );
  }

  private async verifyViaConnector(
    userId: string,
    network: BlockchainNetwork,
    txHash: string,
  ): Promise<BlockchainTransaction> {
    if (network === BlockchainNetwork.STELLAR) {
      return this.stellarService.verifyDeposit(userId, txHash);
    }
    if (this.isEvm(network)) {
      return this.ethereumService.verifyDeposit(userId, txHash, network);
    }
    throw WalletException.unsupportedNetwork(network);
  }

  /** Credit the ledger for a confirmed deposit tx; no-op while still pending. */
  private async creditIfConfirmed(
    tx: BlockchainTransaction,
  ): Promise<DepositResult> {
    if (
      tx.type !== TransactionType.DEPOSIT ||
      tx.status !== TransactionStatus.CONFIRMED
    ) {
      return { transaction: tx, credited: false };
    }

    const amount = Number(tx.amount);
    const balance = await this.ledger.credit(tx.userId, tx.asset, amount, {
      referenceType: 'deposit',
      referenceId: tx.id,
      idempotencyKey: `deposit:${tx.network}:${tx.txHash}`,
      metadata: { network: tx.network, txHash: tx.txHash },
    });

    this.events.emit('wallet.deposit.credited', {
      userId: tx.userId,
      asset: tx.asset,
      amount,
      network: tx.network,
      txHash: tx.txHash,
    });
    this.logger.log(
      `Credited deposit ${tx.txHash} (${amount} ${tx.asset}) to user ${tx.userId}`,
    );
    return { transaction: tx, credited: true, balance };
  }

  /**
   * Poll pending on-chain deposits, refresh their confirmations via the chain
   * connector, and credit the ledger once they reach the per-chain threshold.
   * Chiefly serves EVM deposits (Stellar deposits confirm on first verify).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async reconcilePendingDeposits(): Promise<void> {
    const pending = await this.txRepo.find({
      where: {
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      },
    });
    if (pending.length === 0) return;

    for (const tx of pending) {
      if (!tx.txHash) continue;
      try {
        const refreshed = await this.verifyViaConnector(
          tx.userId,
          tx.network,
          tx.txHash,
        );
        await this.creditIfConfirmed(refreshed);
      } catch (err) {
        this.logger.warn(
          `Deposit reconcile failed for ${tx.txHash}: ${err.message}`,
        );
      }
    }
  }
}
