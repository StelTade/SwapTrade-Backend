/** Whether a fiat payment intent moves money in (deposit) or out (payout). */
export enum FiatDirection {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

/**
 * Lifecycle of a fiat payment intent. Mirrors the coarse states most payment
 * service providers expose, so a real PSP adapter can map onto it later.
 */
export enum FiatIntentStatus {
  CREATED = 'created',
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
