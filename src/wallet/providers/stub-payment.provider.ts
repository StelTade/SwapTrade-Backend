import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  PaymentWebhookEvent,
} from './payment-provider.interface';

/**
 * Sandbox payment provider used in dev/test. It "settles" every intent
 * immediately and synthesizes a provider reference, so the fiat → ledger path
 * can be exercised end-to-end without a real PSP. It performs no network calls
 * and moves no real money.
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';
  private readonly logger = new Logger(StubPaymentProvider.name);

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    const providerRef = `stub_${randomUUID()}`;
    this.logger.log(
      `Created sandbox ${params.direction} intent ${providerRef} ` +
        `(${params.amount} ${params.currency} → ${params.asset})`,
    );
    return { providerRef, settledImmediately: true };
  }

  parseWebhook(
    payload: Record<string, any>,
    _signature?: string,
  ): PaymentWebhookEvent | null {
    if (!payload || typeof payload.providerRef !== 'string') return null;

    const outcome = payload.outcome ?? 'succeeded';
    if (!['succeeded', 'failed', 'cancelled'].includes(outcome)) return null;

    return {
      providerRef: payload.providerRef,
      outcome,
      raw: payload,
    };
  }
}
