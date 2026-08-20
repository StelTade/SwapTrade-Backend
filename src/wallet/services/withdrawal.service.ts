import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { Auth } from '../../auth/entities/auth.entity';
import { MFAService } from '../../auth/mfa.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletRateLimitService } from './wallet-rate-limit.service';
import { BroadcasterRegistry } from './broadcasters/broadcaster.registry';
import { WalletException } from '../exceptions/wallet.exception';
import { InitiateWithdrawalDto } from '../dto/initiate-withdrawal.dto';

/**
 * Orchestrates the withdrawal lifecycle: address validation, per-user rate
 * limits, the high-value 2FA gate, fund reservation, and the admin
 * approve/reject/cancel transitions. Broadcasting is handled asynchronously by
 * {@link WithdrawalProcessorService}; this service only moves requests through
 * their pre-broadcast states and keeps the ledger reservation consistent.
 */
@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);
  private readonly approvalThreshold: number;
  private readonly twoFactorThreshold: number;

  constructor(
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(Auth)
    private readonly authRepo: Repository<Auth>,
    private readonly ledger: WalletLedgerService,
    private readonly rateLimit: WalletRateLimitService,
    private readonly broadcasters: BroadcasterRegistry,
    private readonly mfa: MFAService,
    private readonly events: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.approvalThreshold = this.configService.get<number>(
      'WALLET_WITHDRAWAL_APPROVAL_THRESHOLD',
      1000,
    );
    this.twoFactorThreshold = this.configService.get<number>(
      'WALLET_2FA_THRESHOLD',
      500,
    );
  }

  /**
   * Validate, gate, reserve funds for, and record a new withdrawal request.
   * The reservation is created exactly once here; every downstream transition
   * either releases it (reject/cancel/fail) or debits it (complete).
   */
  async initiateWithdrawal(
    userId: string,
    authId: string,
    dto: InitiateWithdrawalDto,
  ): Promise<WithdrawalRequest> {
    const asset = dto.asset ?? 'USDC';
    const amount = Number(dto.amount);

    if (!this.broadcasters.isValidAddress(dto.network, dto.toAddress)) {
      throw WalletException.invalidAddress(dto.toAddress);
    }

    await this.rateLimit.assertWithinLimits(userId, amount);

    const requiresApproval = amount >= this.approvalThreshold;
    if (amount >= this.twoFactorThreshold) {
      await this.enforceTwoFactor(authId, dto.twoFactorToken);
    }

    // Reserve first so an insufficient balance fails before anything persists.
    const withdrawalId = randomUUID();
    await this.ledger.reserve(userId, asset, amount, {
      referenceType: 'withdrawal',
      referenceId: withdrawalId,
      metadata: { network: dto.network, toAddress: dto.toAddress },
    });

    try {
      const withdrawal = this.withdrawalRepo.create({
        id: withdrawalId,
        userId,
        network: dto.network,
        asset,
        amount,
        toAddress: dto.toAddress,
        memo: dto.memo,
        requiresApproval,
        status: requiresApproval
          ? WithdrawalStatus.PENDING_APPROVAL
          : WithdrawalStatus.QUEUED,
      });
      const saved = await this.withdrawalRepo.save(withdrawal);

      this.events.emit('wallet.withdrawal.initiated', {
        withdrawalId: saved.id,
        userId,
        asset,
        amount,
        network: dto.network,
        status: saved.status,
      });
      this.logger.log(
        `Withdrawal ${saved.id} initiated (${amount} ${asset}) → ${saved.status}`,
      );
      return saved;
    } catch (err) {
      // Compensate: the reservation succeeded but the request could not be
      // persisted, so release the funds to avoid an orphaned reservation.
      await this.ledger
        .release(userId, asset, amount, {
          referenceType: 'withdrawal',
          referenceId: withdrawalId,
          metadata: { reason: 'withdrawal_persist_failed' },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /** Admin approval (2FA enforced): PENDING_APPROVAL → QUEUED. */
  async approveWithdrawal(
    adminAuthId: string,
    id: string,
    twoFactorToken: string,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.getById(id);
    if (withdrawal.status !== WithdrawalStatus.PENDING_APPROVAL) {
      throw WalletException.invalidState(
        `Withdrawal ${id} is not awaiting approval (status: ${withdrawal.status})`,
      );
    }
    await this.enforceTwoFactor(adminAuthId, twoFactorToken);

    withdrawal.status = WithdrawalStatus.QUEUED;
    withdrawal.approvedBy = adminAuthId;
    withdrawal.approvedAt = new Date();
    const saved = await this.withdrawalRepo.save(withdrawal);

    this.events.emit('wallet.withdrawal.approved', {
      withdrawalId: id,
      userId: withdrawal.userId,
      approvedBy: adminAuthId,
    });
    this.logger.log(`Withdrawal ${id} approved by ${adminAuthId} → QUEUED`);
    return saved;
  }

  /** Admin rejection (2FA enforced): PENDING_APPROVAL → REJECTED + release. */
  async rejectWithdrawal(
    adminAuthId: string,
    id: string,
    reason: string,
    twoFactorToken: string,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.getById(id);
    if (withdrawal.status !== WithdrawalStatus.PENDING_APPROVAL) {
      throw WalletException.invalidState(
        `Withdrawal ${id} is not awaiting approval (status: ${withdrawal.status})`,
      );
    }
    await this.enforceTwoFactor(adminAuthId, twoFactorToken);

    await this.releaseReservation(withdrawal, 'rejected');
    withdrawal.status = WithdrawalStatus.REJECTED;
    withdrawal.rejectedReason = reason;
    withdrawal.approvedBy = adminAuthId;
    const saved = await this.withdrawalRepo.save(withdrawal);

    this.events.emit('wallet.withdrawal.rejected', {
      withdrawalId: id,
      userId: withdrawal.userId,
      rejectedBy: adminAuthId,
      reason,
    });
    this.logger.log(`Withdrawal ${id} rejected by ${adminAuthId}`);
    return saved;
  }

  /** User cancellation while still cancellable: → CANCELLED + release. */
  async cancelWithdrawal(
    userId: string,
    id: string,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.getOwned(userId, id);
    const cancellable: WithdrawalStatus[] = [
      WithdrawalStatus.PENDING_APPROVAL,
      WithdrawalStatus.QUEUED,
    ];
    if (!cancellable.includes(withdrawal.status)) {
      throw WalletException.invalidState(
        `Withdrawal ${id} cannot be cancelled (status: ${withdrawal.status})`,
      );
    }

    await this.releaseReservation(withdrawal, 'cancelled');
    withdrawal.status = WithdrawalStatus.CANCELLED;
    const saved = await this.withdrawalRepo.save(withdrawal);

    this.events.emit('wallet.withdrawal.cancelled', {
      withdrawalId: id,
      userId,
    });
    this.logger.log(`Withdrawal ${id} cancelled by user ${userId}`);
    return saved;
  }

  /** A single user's withdrawal by id (404 if not theirs). */
  async getUserWithdrawal(
    userId: string,
    id: string,
  ): Promise<WithdrawalRequest> {
    return this.getOwned(userId, id);
  }

  async listUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
    return this.withdrawalRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listPendingApprovals(): Promise<WithdrawalRequest[]> {
    return this.withdrawalRepo.find({
      where: { status: WithdrawalStatus.PENDING_APPROVAL },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── internals ────────────────────────────────────────────────────────

  private async getById(id: string): Promise<WithdrawalRequest> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal) throw WalletException.withdrawalNotFound(id);
    return withdrawal;
  }

  private async getOwned(
    userId: string,
    id: string,
  ): Promise<WithdrawalRequest> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    // Don't leak existence of other users' withdrawals.
    if (!withdrawal || withdrawal.userId !== userId) {
      throw WalletException.withdrawalNotFound(id);
    }
    return withdrawal;
  }

  private async releaseReservation(
    withdrawal: WithdrawalRequest,
    reason: string,
  ): Promise<void> {
    await this.ledger.release(
      withdrawal.userId,
      withdrawal.asset,
      Number(withdrawal.amount),
      {
        referenceType: 'withdrawal',
        referenceId: withdrawal.id,
        metadata: { reason },
      },
    );
  }

  /**
   * Require a valid 2FA token. `MFAService.verifyToken` returns true when the
   * account has 2FA disabled, so we additionally assert `is2FAEnabled` to close
   * the high-value bypass (acceptance criterion #4).
   */
  private async enforceTwoFactor(
    authId: string,
    token?: string,
  ): Promise<void> {
    const auth = await this.authRepo.findOne({ where: { id: authId } });
    if (!auth || !auth.is2FAEnabled) {
      throw WalletException.twoFactorNotEnabled();
    }
    if (!token) {
      throw WalletException.twoFactorRequired();
    }
    const valid = await this.mfa.verifyToken(authId, token);
    if (!valid) {
      throw WalletException.twoFactorRequired('Invalid 2FA token');
    }
  }
}
