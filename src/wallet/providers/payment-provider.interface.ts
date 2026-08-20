import { FiatDirection } from '../enums/fiat.enum';

/** Request to create a payment session/intent with a provider. */
export interface CreatePaymentParams {
  userId: string;
  direction: FiatDirection;
  amount: number;
  currency: string;
  /** Ledger asset to credit/debit on settlement (e.g. 'USDC'). */
  asset: string;
  metadata?: Record<string, any>;
}

/** Provider's response after creating a payment session/intent. */
export interface CreatePaymentResult {
  /** Opaque provider reference (session/intent id). */
  providerRef: string;
  /** Optional hosted-checkout URL the client should redirect to. */
  redirectUrl?: string;
  /** Whether the provider already settled synchronously (sandbox stub does). */
  settledImmediately: boolean;
}

/** Normalized webhook event after a provider verifies its signature/payload. */
export interface PaymentWebhookEvent {
  providerRef: string;
  outcome: 'succeeded' | 'failed' | 'cancelled';
  raw?: Record<string, any>;
}

/** DI token for the active {@link PaymentProvider} implementation. */
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

/**
 * Provider-agnostic fiat payments port. The wallet module ships a sandbox
 * {@link StubPaymentProvider}; a real PSP (Stripe, etc.) can be dropped in by
 * implementing this interface and rebinding {@link PAYMENT_PROVIDER}.
 */
export interface PaymentProvider {
  readonly name: string;

  /** Create a deposit/payout intent with the provider. */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;

  /**
   * Parse and verify an inbound webhook payload into a normalized event.
   * Returns null if the payload is not a recognized/valid event.
   */
  parseWebhook(
    payload: Record<string, any>,
    signature?: string,
  ): PaymentWebhookEvent | null;
}
