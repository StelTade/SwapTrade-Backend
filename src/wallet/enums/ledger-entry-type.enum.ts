/**
 * Classifies every append-only {@link LedgerEntry} row so the ledger can be
 * reconstructed and audited from its history alone.
 */
export enum LedgerEntryType {
  /** On-chain deposit credited to `available`. */
  DEPOSIT_CREDIT = 'deposit_credit',
  /** Funds moved `available → reserved` when a withdrawal is initiated. */
  WITHDRAWAL_RESERVE = 'withdrawal_reserve',
  /** Reserved funds leave the platform when a withdrawal completes. */
  WITHDRAWAL_DEBIT = 'withdrawal_debit',
  /** Reserved funds returned to `available` when a withdrawal fails/cancels. */
  WITHDRAWAL_RELEASE = 'withdrawal_release',
  /** Fiat on-ramp credited to `available`. */
  FIAT_CREDIT = 'fiat_credit',
  /** Fiat off-ramp debited from `available`. */
  FIAT_DEBIT = 'fiat_debit',
  /** Manual/administrative correction. */
  ADJUSTMENT = 'adjustment',
  /** Funds moved `available → reserved` when a trade is initiated. */
  TRADE_RESERVE = 'trade_reserve',
  /** Reserved funds debited when a trade is executed. */
  TRADE_DEBIT = 'trade_debit',
  /** Funds credited to `available` when a trade is executed. */
  TRADE_CREDIT = 'trade_credit',
}
