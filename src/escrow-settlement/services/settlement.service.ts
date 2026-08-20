import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EscrowAccount } from '../entities/escrow-account.entity';
import { Settlement } from '../entities/settlement.entity';
import { EscrowService } from './escrow.service';
import {
  EscrowStatus,
  SettlementResult,
  RefundReason,
  DisputeReason,
} from '../enums/escrow.enums';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditEventType, AuditSeverity } from '../../common/security/audit-log.entity';

/**
 * DisputeHook interface — downstream services (e.g. notifications, compliance,
 * insurance) implement this to react to dispute lifecycle events.
 *
 * The SettlementService calls registered hooks synchronously; hooks should
 * be fast and non-throwing (errors are caught and logged, not propagated).
 */
export interface DisputeHook {
  /** Called when a dispute is raised on a swap. */
  onDisputeRaised(settlement: Settlement, escrow: EscrowAccount): Promise<void>;
  /** Called when a dispute is resolved (either SETTLE or REFUND). */
  onDisputeResolved(
    settlement: Settlement,
    escrow: EscrowAccount,
    resolution: 'SETTLE' | 'REFUND',
  ): Promise<void>;
}

/**
 * SettlementService — orchestrates the settlement lifecycle for swaps.
 *
 * Responsibilities:
 * - Create Settlement records when escrows are created
 * - Orchestrate full and partial settlements across both sides
 * - Handle dispute hooks (notifying downstream services)
 * - Admin resolution of disputes (SETTLE or REFUND)
 * - Refund orchestration when one side fails or cancels
 *
 * Settlement is the higher-level coordinator; EscrowService handles
 * the individual account-level fund movements.
 */
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private readonly disputeHooks: DisputeHook[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly escrowService: EscrowService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Hook Registration ─────────────────────────────────────────────

  /**
   * Register a dispute hook. Called by downstream modules during bootstrap
   * to receive dispute lifecycle notifications.
   */
  registerDisputeHook(hook: DisputeHook): void {
    this.disputeHooks.push(hook);
    this.logger.log(`Dispute hook registered: ${hook.constructor.name}`);
  }

  // ─── Settlement Creation ───────────────────────────────────────────

  /**
   * Create a new Settlement record for a swap. Called after both escrow
   * accounts have been created for the matched parties.
   */
  async createSettlement(params: {
    swapId: string;
    sellerEscrowId: string;
    buyerEscrowId: string;
    sellerUserId: number;
    buyerUserId: number;
    assetId: number;
    totalAmount: number;
    agreedPrice?: number;
  }): Promise<Settlement> {
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      const existing = await settlementRepo.findOne({ where: { swapId: params.swapId } });
      if (existing) {
        throw new BadRequestException(`Settlement already exists for swap ${params.swapId}`);
      }

      const settlement = settlementRepo.create({
        swapId: params.swapId,
        sellerEscrowId: params.sellerEscrowId,
        buyerEscrowId: params.buyerEscrowId,
        sellerUserId: params.sellerUserId,
        buyerUserId: params.buyerUserId,
        assetId: params.assetId,
        totalAmount: params.totalAmount,
        settledAmount: 0,
        agreedPrice: params.agreedPrice ?? null,
        result: SettlementResult.FULL,
        completed: false,
      });

      const saved = await settlementRepo.save(settlement);
      this.logger.log(`Settlement ${saved.id} created for swap ${params.swapId}`);
      return saved;
    });
  }

  // ─── Full Settlement ───────────────────────────────────────────────

  /**
   * Settle the entire swap — releases funds from both escrow accounts.
   * Called when both parties have confirmed or auto-confirmation triggers.
   */
  async settleSwap(swapId: string, adminUserId?: number): Promise<Settlement> {
    this.logger.log(`Initiating full settlement for swap ${swapId}`);

    const escrows = await this.escrowService.getBySwapId(swapId);
    if (escrows.length === 0) {
      throw new NotFoundException(`No escrow accounts found for swap ${swapId}`);
    }

    const settlement = await this.getSettlementBySwapId(swapId);

    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      // Release funds for each escrow.
      for (const escrow of escrows) {
        if (escrow.status === EscrowStatus.ACTIVE || escrow.status === EscrowStatus.SETTLING) {
          await this.escrowService.releaseFunds(
            escrow.id,
            undefined, // full release
            adminUserId ?? 0,
            settlement.id,
          );
        }
      }

      // Update settlement.
      settlement.result = SettlementResult.FULL;
      settlement.settledAmount = settlement.totalAmount;
      settlement.completed = true;
      await manager.save(Settlement, settlement);

      // Audit
      await this.auditLogService.log({
        userId: String(adminUserId ?? 0),
        eventType: AuditEventType.TRADE_CLOSED,
        severity: AuditSeverity.INFO,
        entityType: 'settlement',
        entityId: settlement.id,
        afterState: { result: SettlementResult.FULL, completed: true },
        metadata: { swapId, escrowIds: escrows.map((e) => e.id) },
      });

      this.logger.log(`Swap ${swapId} fully settled (settlement ${settlement.id})`);
      return settlement;
    });
  }

  // ─── Partial Settlement ────────────────────────────────────────────

  /**
   * Partially settle a swap — releases a portion of one or both escrows.
   * Escrow balances are updated accordingly; the settlement tracks the
   * cumulative settled amount.
   */
  async partialSettleSwap(
    swapId: string,
    params: {
      sellerAmount?: number;
      buyerAmount?: number;
    },
    adminUserId?: number,
  ): Promise<Settlement> {
    this.logger.log(
      `Initiating partial settlement for swap ${swapId}: ` +
      `seller=${params.sellerAmount ?? 'all'}, buyer=${params.buyerAmount ?? 'all'}`,
    );

    const escrows = await this.escrowService.getBySwapId(swapId);
    const settlement = await this.getSettlementBySwapId(swapId);

    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      let totalReleased = 0;

      for (const escrow of escrows) {
        if (escrow.status !== EscrowStatus.ACTIVE && escrow.status !== EscrowStatus.SETTLING) {
          continue;
        }

        // Determine which amount to use for this escrow.
        // If the escrow belongs to the seller side, use sellerAmount; otherwise buyerAmount.
        const isSeller = escrow.userId === settlement.sellerUserId;
        const releaseAmount = isSeller ? params.sellerAmount : params.buyerAmount;

        if (releaseAmount !== undefined && releaseAmount > 0) {
          await this.escrowService.releaseFunds(
            escrow.id,
            releaseAmount,
            adminUserId ?? 0,
            settlement.id,
          );
          totalReleased += releaseAmount;
        } else if (releaseAmount === undefined) {
          // Release all remaining for this side.
          await this.escrowService.releaseFunds(
            escrow.id,
            undefined,
            adminUserId ?? 0,
            settlement.id,
          );
          totalReleased += Number(escrow.remainingAmount);
        }
      }

      // Update settlement.
      settlement.settledAmount = Number(settlement.settledAmount) + totalReleased;
      settlement.result = SettlementResult.PARTIAL;

      // Check if fully settled.
      if (Number(settlement.settledAmount) >= Number(settlement.totalAmount)) {
        settlement.result = SettlementResult.FULL;
        settlement.completed = true;
      }

      await manager.save(Settlement, settlement);

      // Audit
      await this.auditLogService.log({
        userId: String(adminUserId ?? 0),
        eventType: AuditEventType.TRADE_CLOSED,
        severity: AuditSeverity.INFO,
        entityType: 'settlement',
        entityId: settlement.id,
        beforeState: { settledAmount: Number(settlement.settledAmount) - totalReleased },
        afterState: {
          settledAmount: settlement.settledAmount,
          result: settlement.result,
          completed: settlement.completed,
        },
        metadata: { swapId, totalReleased },
      });

      this.logger.log(
        `Swap ${swapId} partially settled: ${totalReleased} released, ` +
        `total settled: ${settlement.settledAmount}/${settlement.totalAmount}`,
      );
      return settlement;
    });
  }

  // ─── Refund Orchestration ──────────────────────────────────────────

  /**
   * Refund the entire swap — returns funds from both escrows to
   * the original depositors. Used when one side cancels, timeouts
   * expire, or disputes are resolved in favour of the depositor.
   */
  async refundSwap(
    swapId: string,
    reasonCode: RefundReason,
    adminUserId?: number,
    description?: string,
  ): Promise<Settlement> {
    this.logger.log(`Initiating full refund for swap ${swapId}, reason: ${reasonCode}`);

    const escrows = await this.escrowService.getBySwapId(swapId);
    if (escrows.length === 0) {
      throw new NotFoundException(`No escrow accounts found for swap ${swapId}`);
    }

    const settlement = await this.getSettlementBySwapId(swapId);

    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      for (const escrow of escrows) {
        if (
          escrow.status === EscrowStatus.ACTIVE ||
          escrow.status === EscrowStatus.SETTLING ||
          escrow.status === EscrowStatus.DISPUTED
        ) {
          await this.escrowService.refundFunds(
            escrow.id,
            undefined, // full refund
            reasonCode,
            adminUserId ?? 0,
            description ?? `Full refund for swap ${swapId}`,
            settlement.id,
          );
        }
      }

      settlement.result = SettlementResult.REFUND;
      settlement.completed = true;
      await manager.save(Settlement, settlement);

      await this.auditLogService.log({
        userId: String(adminUserId ?? 0),
        eventType: AuditEventType.TRADE_CANCELLED,
        severity: reasonCode === RefundReason.ADMIN_MANUAL
          ? AuditSeverity.WARNING
          : AuditSeverity.INFO,
        entityType: 'settlement',
        entityId: settlement.id,
        afterState: { result: SettlementResult.REFUND, completed: true, reasonCode },
        metadata: { swapId, description },
      });

      this.logger.log(`Swap ${swapId} fully refunded (settlement ${settlement.id})`);
      return settlement;
    });
  }

  // ─── Dispute Resolution ────────────────────────────────────────────

  /**
   * Resolve a dispute — either SETTLE (release to counterparty) or
   * REFUND (return to depositor). Calls registered dispute hooks
   * before and after resolution.
   */
  async resolveDispute(
    swapId: string,
    escrowAccountId: string,
    resolution: 'SETTLE' | 'REFUND',
    adminUserId: number,
    notes?: string,
    amount?: number,
  ): Promise<Settlement> {
    this.logger.log(
      `Resolving dispute for swap ${swapId}: ${resolution} ` +
      `by admin ${adminUserId}`,
    );

    const escrow = await this.escrowService.getById(escrowAccountId);
    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new BadRequestException(
        `Escrow ${escrowAccountId} is not in DISPUTED status (current: ${escrow.status})`,
      );
    }

    const settlement = await this.getSettlementBySwapId(swapId);

    // Call dispute hooks BEFORE resolution.
    for (const hook of this.disputeHooks) {
      try {
        await hook.onDisputeResolved(settlement, escrow, resolution);
      } catch (err) {
        this.logger.error(
          `Dispute hook ${hook.constructor.name} failed on pre-resolution: ${err}`,
        );
      }
    }

    // Perform the resolution.
    if (resolution === 'REFUND') {
      await this.escrowService.refundFunds(
        escrowAccountId,
        amount,
        RefundReason.DISPUTE_FAVOUR_DEPOSITOR,
        adminUserId,
        notes ?? `Dispute resolved: refund to depositor`,
        settlement.id,
      );
    } else {
      await this.escrowService.releaseFunds(
        escrowAccountId,
        amount,
        adminUserId,
        settlement.id,
      );
    }

    // Update settlement.
    return this.dataSource.transaction(async (manager) => {
      const settlementRepo = manager.getRepository(Settlement);

      settlement.result = SettlementResult.DISPUTE_RESOLVED;
      settlement.resolvedBy = adminUserId;
      settlement.resolvedAt = new Date();
      settlement.adminNotes = notes ?? null;

      // Check if both escrows are resolved.
      const allEscrows = await this.escrowService.getBySwapId(swapId);
      const allResolved = allEscrows.every(
        (e) =>
          e.status === EscrowStatus.SETTLED ||
          e.status === EscrowStatus.REFUNDED,
      );
      settlement.completed = allResolved;

      await manager.save(Settlement, settlement);

      await this.auditLogService.log({
        userId: String(adminUserId),
        eventType: AuditEventType.ADMIN_ACTION,
        severity: AuditSeverity.WARNING,
        entityType: 'settlement',
        entityId: settlement.id,
        afterState: {
          result: SettlementResult.DISPUTE_RESOLVED,
          resolution,
          completed: settlement.completed,
        },
        metadata: { swapId, escrowAccountId, resolution, notes },
      });

      this.logger.log(
        `Dispute resolved for swap ${swapId}: ${resolution}, ` +
        `settlement completed: ${settlement.completed}`,
      );
      return settlement;
    });
  }

  /**
   * Raise a dispute on a swap — freezes all escrow accounts and
   * notifies dispute hooks.
   */
  async raiseDispute(
    swapId: string,
    escrowAccountId: string,
    reason: DisputeReason,
    description: string,
    raisedBy: number,
  ): Promise<Settlement> {
    const escrow = await this.escrowService.raiseDispute(
      escrowAccountId,
      reason,
      description,
      raisedBy,
    );

    const settlement = await this.getSettlementBySwapId(swapId);

    // Notify dispute hooks.
    for (const hook of this.disputeHooks) {
      try {
        await hook.onDisputeRaised(settlement, escrow);
      } catch (err) {
        this.logger.error(
          `Dispute hook ${hook.constructor.name} failed on raise: ${err}`,
        );
      }
    }

    this.logger.warn(
      `Dispute raised on swap ${swapId}: ${reason} (escrow ${escrowAccountId})`,
    );
    return settlement;
  }

  // ─── Queries ────────────────────────────────────────────────────────

  async getSettlement(id: string): Promise<Settlement> {
    const settlement = await this.dataSource
      .getRepository(Settlement)
      .findOne({ where: { id } });
    if (!settlement) throw new NotFoundException(`Settlement ${id} not found`);
    return settlement;
  }

  async getSettlementBySwapId(swapId: string): Promise<Settlement> {
    const settlement = await this.dataSource
      .getRepository(Settlement)
      .findOne({ where: { swapId } });
    if (!settlement) {
      throw new NotFoundException(`No settlement found for swap ${swapId}`);
    }
    return settlement;
  }

  async getAllSettlements(
    page = 1,
    limit = 50,
    result?: SettlementResult,
  ): Promise<{ data: Settlement[]; total: number; page: number; totalPages: number }> {
    const where: any = {};
    if (result) where.result = result;

    const [data, total] = await this.dataSource
      .getRepository(Settlement)
      .findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getDisputedSettlements(): Promise<Settlement[]> {
    const escrows = await this.dataSource
      .getRepository(EscrowAccount)
      .find({ where: { status: EscrowStatus.DISPUTED } });

    const swapIds = [...new Set(escrows.map((e) => e.swapId))];
    if (swapIds.length === 0) return [];

    return this.dataSource
      .getRepository(Settlement)
      .createQueryBuilder('s')
      .where('s.swapId IN (:...swapIds)', { swapIds })
      .orderBy('s.createdAt', 'DESC')
      .getMany();
  }
}
