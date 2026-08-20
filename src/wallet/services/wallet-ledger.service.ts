import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WalletLedger } from '../entities/wallet-ledger.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { WalletException } from '../exceptions/wallet.exception';

/** Provenance attached to every ledger mutation, for audit + idempotency. */
export interface LedgerRef {
  /** e.g. 'deposit', 'withdrawal', 'fiat_intent', 'adjustment'. */
  referenceType: string;
  /** Id of the referenced domain object. */
  referenceId: string;
  /**
   * Unique key for externally-triggered movements (e.g. `deposit:bsc:<txHash>`).
   * If an entry with this key already exists, the mutation is a no-op.
   */
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

/** Read model for a single (userId, asset) balance. */
export interface LedgerBalance {
  asset: string;
  available: number;
  reserved: number;
  total: number;
}

/** Rounds to the ledger's 8-decimal scale to avoid float drift. */
function round8(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
}

/**
 * Core real-funds ledger. All mutations run inside a single DB transaction with
 * a `pessimistic_write` row lock on the {@link WalletLedger} (same pattern as
 * orders.service.ts), and each writes an append-only {@link LedgerEntry} with
 * post-mutation balance snapshots.
 *
 * Invariants enforced here:
 *  - `available` is checked against the requested amount **before** any reserve
 *    or debit, so it can never go negative;
 *  - `reserved` is clamped at 0 on release/debit;
 *  - credits carrying an `idempotencyKey` are applied at most once.
 *
 * This service is exported so a future order-settlement layer can reserve real
 * funds against it, satisfying acceptance criterion #3 at the primitive level.
 */
@Injectable()
export class WalletLedgerService {
  private readonly logger = new Logger(WalletLedgerService.name);
  private readonly ledgerRepo: Repository<WalletLedger>;
  private readonly entryRepo: Repository<LedgerEntry>;

  constructor(private readonly dataSource: DataSource) {
    this.ledgerRepo = this.dataSource.getRepository(WalletLedger);
    this.entryRepo = this.dataSource.getRepository(LedgerEntry);
  }

  /** Current balance for one asset; zeros if the ledger doesn't exist yet. */
  async getBalance(userId: string, asset = 'USDC'): Promise<LedgerBalance> {
    const ledger = await this.ledgerRepo.findOne({ where: { userId, asset } });
    return {
      asset,
      available: ledger ? Number(ledger.available) : 0,
      reserved: ledger ? Number(ledger.reserved) : 0,
      total: ledger ? ledger.total : 0,
    };
  }

  /** All balances held by a user. */
  async getBalances(userId: string): Promise<LedgerBalance[]> {
    const ledgers = await this.ledgerRepo.find({ where: { userId } });
    return ledgers.map((l) => ({
      asset: l.asset,
      available: Number(l.available),
      reserved: Number(l.reserved),
      total: l.total,
    }));
  }

  /** Ensures a ledger row exists for (userId, asset) and returns it. */
  async getOrCreateLedger(
    userId: string,
    asset = 'USDC',
  ): Promise<WalletLedger> {
    const existing = await this.ledgerRepo.findOne({
      where: { userId, asset },
    });
    if (existing) return existing;
    try {
      return await this.ledgerRepo.save(
        this.ledgerRepo.create({ userId, asset, available: 0, reserved: 0 }),
      );
    } catch {
      // Concurrent create — the unique (userId, asset) index protects us.
      const ledger = await this.ledgerRepo.findOne({
        where: { userId, asset },
      });
      if (!ledger) {
        throw WalletException.invalidState(
          `Failed to create ledger for ${userId}/${asset}`,
        );
      }
      return ledger;
    }
  }

  /** Append-only history, most recent first. */
  async getLedgerHistory(
    userId: string,
    asset?: string,
  ): Promise<LedgerEntry[]> {
    return this.entryRepo.find({
      where: asset ? { userId, asset } : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Credit `available`. Idempotent when `ref.idempotencyKey` is supplied: a
   * repeated credit for the same key returns the current balance unchanged.
   */
  async credit(
    userId: string,
    asset: string,
    amount: number,
    ref: LedgerRef,
    entryType: LedgerEntryType = LedgerEntryType.DEPOSIT_CREDIT,
  ): Promise<LedgerBalance> {
    this.assertPositive(amount);
    return this.dataSource.transaction(async (manager) => {
      if (await this.alreadyApplied(manager, ref.idempotencyKey)) {
        this.logger.debug(
          `Skipping duplicate credit for key ${ref.idempotencyKey}`,
        );
        return this.readBalance(manager, userId, asset);
      }
      const ledger = await this.lockOrCreate(manager, userId, asset);
      return this.applyEntry(manager, ledger, {
        entryType,
        amount,
        availableDelta: round8(amount),
        reservedDelta: 0,
        ref,
      });
    });
  }

  /**
   * Move funds `available → reserved`. Throws
   * {@link WalletException.insufficientBalance} if `available < amount`.
   */
  async reserve(
    userId: string,
    asset: string,
    amount: number,
    ref: LedgerRef,
  ): Promise<LedgerBalance> {
    this.assertPositive(amount);
    return this.dataSource.transaction(async (manager) => {
      const ledger = await this.lockOrCreate(manager, userId, asset);
      if (Number(ledger.available) < amount) {
        throw WalletException.insufficientBalance({
          asset,
          available: Number(ledger.available),
          requested: amount,
        });
      }
      return this.applyEntry(manager, ledger, {
        entryType: LedgerEntryType.WITHDRAWAL_RESERVE,
        amount,
        availableDelta: round8(-amount),
        reservedDelta: round8(amount),
        ref,
      });
    });
  }

  /** Move funds `reserved → available` (clamped so `reserved` stays ≥ 0). */
  async release(
    userId: string,
    asset: string,
    amount: number,
    ref: LedgerRef,
  ): Promise<LedgerBalance> {
    this.assertPositive(amount);
    return this.dataSource.transaction(async (manager) => {
      const ledger = await this.lockOrCreate(manager, userId, asset);
      const effective = Math.min(amount, Number(ledger.reserved));
      return this.applyEntry(manager, ledger, {
        entryType: LedgerEntryType.WITHDRAWAL_RELEASE,
        amount: effective,
        availableDelta: round8(effective),
        reservedDelta: round8(-effective),
        ref,
      });
    });
  }

  /**
   * Debit `reserved` when funds have left the platform (withdrawal complete).
   * `total` drops by the debited amount. Clamped so `reserved` stays ≥ 0.
   * Idempotent when `ref.idempotencyKey` is supplied, so the withdrawal
   * completion debit is applied at most once under concurrent/retried crons.
   */
  async debitReserved(
    userId: string,
    asset: string,
    amount: number,
    ref: LedgerRef,
  ): Promise<LedgerBalance> {
    this.assertPositive(amount);
    return this.dataSource.transaction(async (manager) => {
      if (await this.alreadyApplied(manager, ref.idempotencyKey)) {
        this.logger.debug(
          `Skipping duplicate reserved-debit for key ${ref.idempotencyKey}`,
        );
        return this.readBalance(manager, userId, asset);
      }
      const ledger = await this.lockOrCreate(manager, userId, asset);
      const effective = Math.min(amount, Number(ledger.reserved));
      return this.applyEntry(manager, ledger, {
        entryType: LedgerEntryType.WITHDRAWAL_DEBIT,
        amount: effective,
        availableDelta: 0,
        reservedDelta: round8(-effective),
        ref,
      });
    });
  }

  /** Debit `available` directly (fiat off-ramp / adjustment). Non-negative. */
  async debit(
    userId: string,
    asset: string,
    amount: number,
    ref: LedgerRef,
    entryType: LedgerEntryType = LedgerEntryType.FIAT_DEBIT,
  ): Promise<LedgerBalance> {
    this.assertPositive(amount);
    return this.dataSource.transaction(async (manager) => {
      const ledger = await this.lockOrCreate(manager, userId, asset);
      if (Number(ledger.available) < amount) {
        throw WalletException.insufficientBalance({
          asset,
          available: Number(ledger.available),
          requested: amount,
        });
      }
      return this.applyEntry(manager, ledger, {
        entryType,
        amount,
        availableDelta: round8(-amount),
        reservedDelta: 0,
        ref,
      });
    });
  }

  // ─── internals ────────────────────────────────────────────────────────

  private assertPositive(amount: number): void {
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw WalletException.invalidState('Amount must be a positive number');
    }
  }

  private async alreadyApplied(
    manager: EntityManager,
    idempotencyKey?: string,
  ): Promise<boolean> {
    if (!idempotencyKey) return false;
    const existing = await manager.findOne(LedgerEntry, {
      where: { idempotencyKey },
    });
    return !!existing;
  }

  private async lockOrCreate(
    manager: EntityManager,
    userId: string,
    asset: string,
  ): Promise<WalletLedger> {
    let ledger = await manager.findOne(WalletLedger, {
      where: { userId, asset },
      lock: { mode: 'pessimistic_write' },
    });
    if (ledger) return ledger;

    try {
      await manager.save(
        WalletLedger,
        manager.create(WalletLedger, {
          userId,
          asset,
          available: 0,
          reserved: 0,
        }),
      );
    } catch {
      // Concurrent insert lost the race — re-read below under the lock.
    }
    ledger = await manager.findOne(WalletLedger, {
      where: { userId, asset },
      lock: { mode: 'pessimistic_write' },
    });
    if (!ledger) {
      throw WalletException.invalidState(
        `Failed to lock or create ledger for ${userId}/${asset}`,
      );
    }
    return ledger;
  }

  private async applyEntry(
    manager: EntityManager,
    ledger: WalletLedger,
    params: {
      entryType: LedgerEntryType;
      amount: number;
      availableDelta: number;
      reservedDelta: number;
      ref: LedgerRef;
    },
  ): Promise<LedgerBalance> {
    const nextAvailable = round8(Number(ledger.available) + params.availableDelta);
    const nextReserved = round8(Number(ledger.reserved) + params.reservedDelta);

    // Defensive guard: the public methods already prevent this, but never
    // allow a negative balance to be persisted.
    if (nextAvailable < 0 || nextReserved < 0) {
      throw WalletException.invalidState(
        'Ledger mutation would produce a negative balance',
      );
    }

    ledger.available = nextAvailable;
    ledger.reserved = nextReserved;
    await manager.save(WalletLedger, ledger);

    const entry = manager.create(LedgerEntry, {
      userId: ledger.userId,
      asset: ledger.asset,
      entryType: params.entryType,
      amount: round8(params.amount),
      availableDelta: params.availableDelta,
      reservedDelta: params.reservedDelta,
      balanceAfterAvailable: nextAvailable,
      balanceAfterReserved: nextReserved,
      referenceType: params.ref.referenceType,
      referenceId: params.ref.referenceId,
      idempotencyKey: params.ref.idempotencyKey ?? null,
      metadata: params.ref.metadata ?? null,
    });
    await manager.save(LedgerEntry, entry);

    return {
      asset: ledger.asset,
      available: nextAvailable,
      reserved: nextReserved,
      total: round8(nextAvailable + nextReserved),
    };
  }

  private async readBalance(
    manager: EntityManager,
    userId: string,
    asset: string,
  ): Promise<LedgerBalance> {
    const ledger = await manager.findOne(WalletLedger, {
      where: { userId, asset },
    });
    return {
      asset,
      available: ledger ? Number(ledger.available) : 0,
      reserved: ledger ? Number(ledger.reserved) : 0,
      total: ledger ? ledger.total : 0,
    };
  }
}
