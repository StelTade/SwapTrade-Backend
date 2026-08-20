import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { EscrowTransaction } from '../entities/escrow-transaction.entity';
import { Settlement } from '../entities/settlement.entity';
import { UserBalance } from '../../database/entities/user-balance.entity';
import {
  EscrowStatus,
  EscrowTransactionType,
  RefundReason,
  SettlementResult,
} from '../enums/escrow.enums';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditEventType, AuditSeverity } from '../../common/security/audit-log.entity';
import { CreateEscrowDto } from '../dto/escrow-settlement.dto';

/**
 * EscrowService — core service for managing escrow accounts.
 *
 * Responsibilities:
 * - Create escrow accounts for matched swaps (locking funds)
 * - Release funds on settlement (full or partial)
 * - Refund funds on failure, cancellation, or dispute resolution
 * - Record every movement as an immutable EscrowTransaction
 * - Integrate with AuditLogService for forensic audit trail
 *
 * All fund movements are performed inside a single database transaction
 * to ensure atomicity and prevent double-spends.
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Escrow Creation (Lock Funds) ──────────────────────────────────

  /**
   * Create an escrow account for one side of a swap and lock the
   * corresponding funds from the user's balance.
   *
   * This is called twice per swap: once for the seller (asset being sold)
   * and once for the buyer (settlement currency / asset being paid).
   */
  async createEscrow(dto: CreateEscrowDto): Promise<EscrowAccount> {
    this.logger.log(
      `Creating escrow for swap ${dto.swapId}, user ${dto.userId}, ` +
      `asset ${dto.assetId}, amount ${dto.amount}`,
    );

    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(UserBalance);
      const escrowRepo = manager.getRepository(EscrowAccount);
      const txRepo = manager.getRepository(EscrowTransaction);

      // Lock the user's balance row pessimistically to prevent race conditions.
      const balance = await balanceRepo.findOne({
        where: { userId: dto.userId, assetId: dto.assetId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new BadRequestException(
          `No balance found for user ${dto.userId} and asset ${dto.assetId}`,
        );
      }

      const available = Number(balance.balance) - Number(balance.lockedBalance);
      if (available < dto.amount) {
        throw new BadRequestException(
          `Insufficient available balance: have ${available}, need ${dto.amount}`,
        );
      }

      // Reserve the funds — increase lockedBalance, decrease available.
      balance.lockedBalance = Number(balance.lockedBalance) + dto.amount;
      await manager.save(UserBalance, balance);

      // Create the escrow account.
      const escrow = escrowRepo.create({
        swapId: dto.swapId,
        userId: dto.userId,
        orderId: dto.orderId ?? null,
        counterpartyOrderId: dto.counterpartyOrderId ?? null,
        counterpartyUserId: dto.counterpartyUserId ?? null,
        assetId: dto.assetId,
        depositedAmount: dto.amount,
        remainingAmount: dto.amount,
        agreedPrice: dto.agreedPrice ?? null,
        status: EscrowStatus.ACTIVE,
        settled: false,
      });
      const savedEscrow = await manager.save(EscrowAccount, escrow);

      // Record the deposit transaction.
      const tx = txRepo.create({
        escrowAccountId: savedEscrow.id,
        swapId: dto.swapId,
        type: EscrowTransactionType.DEPOSIT,
        amount: dto.amount,
        balanceAfter: dto.amount,
        initiatedBy: dto.userId,
        reasonCode: 'SWAP_CREATED',
        description: `Escrow created for swap ${dto.swapId}`,
      });
      await manager.save(EscrowTransaction, tx);

      // Audit log
      await this.auditLogService.log({
        userId: String(dto.userId),
        eventType: AuditEventType.TRADE_OPENED,
        severity: AuditSeverity.INFO,
        entityType: 'escrow_account',
        entityId: savedEscrow.id,
        afterState: {
          swapId: dto.swapId,
          assetId: dto.assetId,
          amount: dto.amount,
          status: EscrowStatus.ACTIVE,
        },
        metadata: { orderId: dto.orderId, counterpartyOrderId: dto.counterpartyOrderId },
      });

      this.logger.log(`Escrow ${savedEscrow.id} created for swap ${dto.swapId}`);
      return savedEscrow;
    });
  }

  // ─── Settlement (Release Funds) ────────────────────────────────────

  /**
   * Release escrowed funds to the counterparty upon successful settlement.
   * Supports both full and partial releases.
   *
   * @param escrowAccountId - The escrow to settle
   * @param releaseAmount - Amount to release (must be <= remainingAmount)
   * @param initiatedBy - Admin user id (0 for automated settlement)
   * @param settlementId - Optional linked settlement id
   */
  async releaseFunds(
    escrowAccountId: string,
    releaseAmount?: number,
    initiatedBy?: number,
    settlementId?: string,
  ): Promise<EscrowTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const escrowRepo = manager.getRepository(EscrowAccount);
      const txRepo = manager.getRepository(EscrowTransaction);
      const balanceRepo = manager.getRepository(UserBalance);

      const escrow = await escrowRepo.findOne({
        where: { id: escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundException(`Escrow account ${escrowAccountId} not found`);
      }

      if (escrow.status === EscrowStatus.SETTLED) {
        throw new BadRequestException('Escrow is already fully settled');
      }

      if (escrow.status === EscrowStatus.REFUNDED) {
        throw new BadRequestException('Escrow has been refunded — cannot release');
      }

      if (escrow.status === EscrowStatus.CANCELLED) {
        throw new BadRequestException('Escrow is cancelled — cannot release');
      }

      const amount = releaseAmount ?? Number(escrow.remainingAmount);
      if (amount <= 0) {
        throw new BadRequestException('Release amount must be greater than zero');
      }
      if (amount > Number(escrow.remainingAmount)) {
        throw new BadRequestException(
          `Release amount ${amount} exceeds remaining balance ${escrow.remainingAmount}`,
        );
      }

      const newRemaining = Number(escrow.remainingAmount) - amount;
      escrow.remainingAmount = newRemaining;

      // Determine the transaction type based on whether this is a full or partial release.
      const txType = newRemaining === 0
        ? EscrowTransactionType.RELEASE
        : EscrowTransactionType.PARTIAL_RELEASE;

      if (newRemaining === 0) {
        escrow.status = EscrowStatus.SETTLED;
        escrow.settled = true;
        escrow.resolvedAt = new Date();
        if (initiatedBy) escrow.resolvedBy = initiatedBy;
      } else {
        escrow.status = EscrowStatus.SETTLING;
      }

      await manager.save(EscrowAccount, escrow);

      // Credit the counterparty's balance.
      if (escrow.counterpartyUserId) {
        const counterpartyBalance = await balanceRepo.findOne({
          where: {
            userId: escrow.counterpartyUserId,
            assetId: escrow.assetId,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (counterpartyBalance) {
          counterpartyBalance.balance = Number(counterpartyBalance.balance) + amount;
          counterpartyBalance.totalTrades += 1;
          counterpartyBalance.lastTradeDate = new Date();
          await manager.save(UserBalance, counterpartyBalance);
        }
      }

      // Record the release transaction.
      const tx = txRepo.create({
        escrowAccountId: escrow.id,
        swapId: escrow.swapId,
        type: txType,
        amount,
        balanceAfter: newRemaining,
        initiatedBy: initiatedBy ?? null,
        reasonCode: initiatedBy ? 'ADMIN_MANUAL' : 'AUTO_SETTLE',
        description: initiatedBy
          ? `Admin manual release of ${amount}`
          : `Automated settlement release of ${amount}`,
        settlementId: settlementId ?? null,
      });
      const savedTx = await manager.save(EscrowTransaction, tx);

      // Audit log
      await this.auditLogService.log({
        userId: String(initiatedBy ?? escrow.userId),
        eventType: AuditEventType.TRADE_CLOSED,
        severity: AuditSeverity.INFO,
        entityType: 'escrow_account',
        entityId: escrow.id,
        beforeState: { remainingAmount: Number(escrow.remainingAmount) + amount, status: escrow.status },
        afterState: { remainingAmount: newRemaining, status: escrow.status },
        metadata: { txType, releaseAmount: amount, settlementId },
      });

      this.logger.log(
        `Released ${amount} from escrow ${escrow.id} (${txType}), ` +
        `remaining: ${newRemaining}`,
      );
      return savedTx;
    });
  }

  // ─── Refund (Return Funds to Depositor) ────────────────────────────

  /**
   * Refund escrowed funds back to the original depositor.
   * Supports both full and partial refunds.
   *
   * @param escrowAccountId - The escrow to refund
   * @param refundAmount - Amount to refund (defaults to full remaining)
   * @param reasonCode - Why the refund is happening
   * @param initiatedBy - Admin user id or 0 for automated
   * @param description - Free-text explanation
   * @param settlementId - Optional linked settlement id
   */
  async refundFunds(
    escrowAccountId: string,
    refundAmount?: number,
    reasonCode?: RefundReason,
    initiatedBy?: number,
    description?: string,
    settlementId?: string,
  ): Promise<EscrowTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const escrowRepo = manager.getRepository(EscrowAccount);
      const txRepo = manager.getRepository(EscrowTransaction);
      const balanceRepo = manager.getRepository(UserBalance);

      const escrow = await escrowRepo.findOne({
        where: { id: escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundException(`Escrow account ${escrowAccountId} not found`);
      }

      if (escrow.status === EscrowStatus.REFUNDED) {
        throw new BadRequestException('Escrow is already fully refunded');
      }

      if (escrow.status === EscrowStatus.SETTLED) {
        throw new BadRequestException('Escrow is settled — cannot refund');
      }

      const amount = refundAmount ?? Number(escrow.remainingAmount);
      if (amount <= 0) {
        throw new BadRequestException('Refund amount must be greater than zero');
      }
      if (amount > Number(escrow.remainingAmount)) {
        throw new BadRequestException(
          `Refund amount ${amount} exceeds remaining balance ${escrow.remainingAmount}`,
        );
      }

      const newRemaining = Number(escrow.remainingAmount) - amount;
      escrow.remainingAmount = newRemaining;

      const txType = newRemaining === 0
        ? EscrowTransactionType.REFUND
        : EscrowTransactionType.PARTIAL_REFUND;

      if (newRemaining === 0) {
        escrow.status = EscrowStatus.REFUNDED;
        escrow.settled = false;
        escrow.resolvedAt = new Date();
        if (initiatedBy) escrow.resolvedBy = initiatedBy;
        if (reasonCode) escrow.reasonCode = reasonCode;
      }

      await manager.save(EscrowAccount, escrow);

      // Release locked funds and credit back to depositor's available balance.
      const depositorBalance = await balanceRepo.findOne({
        where: { userId: escrow.userId, assetId: escrow.assetId },
        lock: { mode: 'pessimistic_write' },
      });

      if (depositorBalance) {
        depositorBalance.lockedBalance = Math.max(
          0,
          Number(depositorBalance.lockedBalance) - amount,
        );
        depositorBalance.balance = Number(depositorBalance.balance) + amount;
        await manager.save(UserBalance, depositorBalance);
      }

      // Record the refund transaction.
      const tx = txRepo.create({
        escrowAccountId: escrow.id,
        swapId: escrow.swapId,
        type: txType,
        amount,
        balanceAfter: newRemaining,
        initiatedBy: initiatedBy ?? null,
        reasonCode: reasonCode ?? 'UNKNOWN',
        description: description ?? `Refund of ${amount}`,
        settlementId: settlementId ?? null,
      });
      const savedTx = await manager.save(EscrowTransaction, tx);

      // Audit log
      await this.auditLogService.log({
        userId: String(initiatedBy ?? escrow.userId),
        eventType: AuditEventType.TRADE_CANCELLED,
        severity: reasonCode === RefundReason.ADMIN_MANUAL
          ? AuditSeverity.WARNING
          : AuditSeverity.INFO,
        entityType: 'escrow_account',
        entityId: escrow.id,
        beforeState: { remainingAmount: Number(escrow.remainingAmount) + amount },
        afterState: { remainingAmount: newRemaining, reasonCode },
        metadata: { txType, refundAmount: amount, settlementId, description },
      });

      this.logger.log(
        `Refunded ${amount} from escrow ${escrow.id} (${txType}), ` +
        `remaining: ${newRemaining}, reason: ${reasonCode}`,
      );
      return savedTx;
    });
  }

  // ─── Dispute Management ────────────────────────────────────────────

  /**
   * Raise a dispute on an escrow account — freezes the escrow
   * and prevents any further settlement or refund until resolved.
   */
  async raiseDispute(
    escrowAccountId: string,
    reason: string,
    description: string,
    raisedBy: number,
  ): Promise<EscrowAccount> {
    return this.dataSource.transaction(async (manager) => {
      const escrowRepo = manager.getRepository(EscrowAccount);

      const escrow = await escrowRepo.findOne({
        where: { id: escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundException(`Escrow account ${escrowAccountId} not found`);
      }

      if (
        escrow.status === EscrowStatus.SETTLED ||
        escrow.status === EscrowStatus.REFUNDED ||
        escrow.status === EscrowStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot dispute escrow in status ${escrow.status}`,
        );
      }

      const previousStatus = escrow.status;
      escrow.status = EscrowStatus.DISPUTED;
      escrow.reasonCode = reason;
      await manager.save(EscrowAccount, escrow);

      // Audit log
      await this.auditLogService.log({
        userId: String(raisedBy),
        eventType: AuditEventType.ADMIN_ACTION,
        severity: AuditSeverity.WARNING,
        entityType: 'escrow_account',
        entityId: escrow.id,
        beforeState: { status: previousStatus },
        afterState: { status: EscrowStatus.DISPUTED, reason, description },
        metadata: { action: 'RAISE_DISPUTE', description },
      });

      this.logger.warn(
        `Dispute raised on escrow ${escrow.id} by user ${raisedBy}: ${reason}`,
      );
      return escrow;
    });
  }

  // ─── Queries ────────────────────────────────────────────────────────

  async getById(id: string): Promise<EscrowAccount> {
    const escrow = await this.dataSource
      .getRepository(EscrowAccount)
      .findOne({ where: { id } });
    if (!escrow) throw new NotFoundException(`Escrow account ${id} not found`);
    return escrow;
  }

  async getBySwapId(swapId: string): Promise<EscrowAccount[]> {
    return this.dataSource
      .getRepository(EscrowAccount)
      .find({ where: { swapId } });
  }

  async getByUserId(userId: number, status?: EscrowStatus): Promise<EscrowAccount[]> {
    const where: any = { userId };
    if (status) where.status = status;
    return this.dataSource.getRepository(EscrowAccount).find({ where });
  }

  async getAll(
    page = 1,
    limit = 50,
    status?: EscrowStatus,
  ): Promise<{ data: EscrowAccount[]; total: number; page: number; totalPages: number }> {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.dataSource
      .getRepository(EscrowAccount)
      .findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getTransactions(escrowAccountId: string): Promise<EscrowTransaction[]> {
    return this.dataSource
      .getRepository(EscrowTransaction)
      .find({
        where: { escrowAccountId },
        order: { createdAt: 'ASC' },
      });
  }

  async getTransactionsBySwapId(swapId: string): Promise<EscrowTransaction[]> {
    return this.dataSource
      .getRepository(EscrowTransaction)
      .find({
        where: { swapId },
        order: { createdAt: 'ASC' },
      });
  }
}
