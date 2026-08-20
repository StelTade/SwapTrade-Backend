import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { FiatPaymentIntent } from '../entities/fiat-payment-intent.entity';
import { FiatDirection, FiatIntentStatus } from '../enums/fiat.enum';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import { WalletLedgerService } from './wallet-ledger.service';
import { PAYMENT_PROVIDER } from '../providers/payment-provider.interface';
import type { PaymentProvider } from '../providers/payment-provider.interface';
import { FiatIntentDto } from '../dto/fiat-intent.dto';
import { WalletException } from '../exceptions/wallet.exception';

/** Return shape for intent-creating calls. */
export interface FiatIntentResult {
  intent: FiatPaymentIntent;
  redirectUrl?: string;
}

/**
 * Bridges the provider-agnostic fiat rails to the real-funds ledger. Deposits
 * credit the ledger on settlement (immediately for the sandbox stub, or on a
 * `succeeded` webhook for a real PSP); payouts debit available funds up front
 * and refund on provider failure. All ledger movements are idempotent on the
 * provider reference / intent id so repeated webhooks never double-apply.
 */
@Injectable()
export class FiatPaymentService {
  private readonly logger = new Logger(FiatPaymentService.name);

  constructor(
    @InjectRepository(FiatPaymentIntent)
    private readonly intentRepo: Repository<FiatPaymentIntent>,
    private readonly ledger: WalletLedgerService,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProvider,
    private readonly events: EventEmitter2,
  ) {}

  /** Create a fiat → crypto deposit intent; credits the ledger on settlement. */
  async createDepositIntent(
    userId: string,
    dto: FiatIntentDto,
  ): Promise<FiatIntentResult> {
    const currency = dto.currency ?? 'USD';
    const asset = dto.asset ?? 'USDC';
    const amount = Number(dto.amount);

    const result = await this.provider.createPayment({
      userId,
      direction: FiatDirection.DEPOSIT,
      amount,
      currency,
      asset,
    });

    const intent = await this.intentRepo.save(
      this.intentRepo.create({
        userId,
        direction: FiatDirection.DEPOSIT,
        provider: this.provider.name,
        providerRef: result.providerRef,
        currency,
        amount,
        asset,
        status: FiatIntentStatus.PENDING,
      }),
    );

    if (result.settledImmediately) {
      await this.settleDeposit(intent);
    }
    return { intent, redirectUrl: result.redirectUrl };
  }

  /** Create a crypto → fiat payout; debits available funds up front. */
  async createPayout(
    userId: string,
    dto: FiatIntentDto,
  ): Promise<FiatIntentResult> {
    const currency = dto.currency ?? 'USD';
    const asset = dto.asset ?? 'USDC';
    const amount = Number(dto.amount);
    const intentId = randomUUID();

    // Debit available first — throws WALLET_INSUFFICIENT_BALANCE if too low.
    await this.ledger.debit(
      userId,
      asset,
      amount,
      {
        referenceType: 'fiat_payout',
        referenceId: intentId,
        idempotencyKey: `fiat-payout-debit:${intentId}`,
      },
      LedgerEntryType.FIAT_DEBIT,
    );

    let result;
    try {
      result = await this.provider.createPayment({
        userId,
        direction: FiatDirection.WITHDRAWAL,
        amount,
        currency,
        asset,
      });
    } catch (err) {
      // Provider never accepted the payout → refund the debit.
      await this.refund(userId, asset, amount, intentId, 'provider_create_failed');
      throw err;
    }

    const intent = await this.intentRepo.save(
      this.intentRepo.create({
        id: intentId,
        userId,
        direction: FiatDirection.WITHDRAWAL,
        provider: this.provider.name,
        providerRef: result.providerRef,
        currency,
        amount,
        asset,
        status: result.settledImmediately
          ? FiatIntentStatus.SUCCEEDED
          : FiatIntentStatus.PENDING,
      }),
    );

    this.events.emit('wallet.fiat.payout.created', {
      intentId: intent.id,
      userId,
      amount,
      asset,
      status: intent.status,
    });
    return { intent, redirectUrl: result.redirectUrl };
  }

  /** Apply a provider webhook to the referenced intent. */
  async handleWebhook(
    payload: Record<string, any>,
    signature?: string,
  ): Promise<FiatPaymentIntent> {
    const event = this.provider.parseWebhook(payload, signature);
    if (!event) {
      throw WalletException.invalidState('Unrecognized or invalid webhook payload');
    }

    const intent = await this.intentRepo.findOne({
      where: { providerRef: event.providerRef },
    });
    if (!intent) {
      throw WalletException.invalidState(
        `No fiat intent for providerRef ${event.providerRef}`,
      );
    }

    if (event.outcome === 'succeeded') {
      if (intent.direction === FiatDirection.DEPOSIT) {
        await this.settleDeposit(intent);
      } else if (intent.status !== FiatIntentStatus.SUCCEEDED) {
        intent.status = FiatIntentStatus.SUCCEEDED;
        await this.intentRepo.save(intent);
      }
    } else {
      await this.failIntent(intent, event.outcome);
    }
    return intent;
  }

  async getUserIntents(userId: string): Promise<FiatPaymentIntent[]> {
    return this.intentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── internals ────────────────────────────────────────────────────────

  /** Idempotent credit for a settled deposit (keyed on the provider ref). */
  private async settleDeposit(intent: FiatPaymentIntent): Promise<void> {
    if (intent.status === FiatIntentStatus.SUCCEEDED) return;

    await this.ledger.credit(
      intent.userId,
      intent.asset,
      Number(intent.amount),
      {
        referenceType: 'fiat_deposit',
        referenceId: intent.id,
        idempotencyKey: `fiat:${intent.providerRef}`,
        metadata: { provider: intent.provider },
      },
      LedgerEntryType.FIAT_CREDIT,
    );

    intent.status = FiatIntentStatus.SUCCEEDED;
    await this.intentRepo.save(intent);
    this.events.emit('wallet.fiat.deposit.credited', {
      intentId: intent.id,
      userId: intent.userId,
      amount: Number(intent.amount),
      asset: intent.asset,
    });
    this.logger.log(
      `Fiat deposit ${intent.id} settled (${intent.amount} ${intent.asset})`,
    );
  }

  private async failIntent(
    intent: FiatPaymentIntent,
    outcome: 'failed' | 'cancelled',
  ): Promise<void> {
    const finalStatus =
      outcome === 'cancelled'
        ? FiatIntentStatus.CANCELLED
        : FiatIntentStatus.FAILED;

    // A payout debited funds up front; refund it if it never succeeded.
    if (
      intent.direction === FiatDirection.WITHDRAWAL &&
      intent.status !== FiatIntentStatus.SUCCEEDED &&
      intent.status !== finalStatus
    ) {
      await this.refund(
        intent.userId,
        intent.asset,
        Number(intent.amount),
        intent.id,
        outcome,
      );
    }

    intent.status = finalStatus;
    await this.intentRepo.save(intent);
    this.events.emit('wallet.fiat.failed', {
      intentId: intent.id,
      userId: intent.userId,
      outcome,
    });
  }

  /** Idempotent compensating credit for a failed/cancelled payout. */
  private async refund(
    userId: string,
    asset: string,
    amount: number,
    intentId: string,
    reason: string,
  ): Promise<void> {
    await this.ledger
      .credit(
        userId,
        asset,
        amount,
        {
          referenceType: 'fiat_payout',
          referenceId: intentId,
          idempotencyKey: `fiat-payout-refund:${intentId}`,
          metadata: { reason },
        },
        LedgerEntryType.ADJUSTMENT,
      )
      .catch((e) =>
        this.logger.error(
          `Failed to refund fiat payout ${intentId}: ${e.message}`,
        ),
      );
  }
}
