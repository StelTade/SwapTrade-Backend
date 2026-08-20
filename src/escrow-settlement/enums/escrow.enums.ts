/**
 * Escrow statuses represent the lifecycle of an escrow hold
 * from creation through settlement or refund.
 */
export enum EscrowStatus {
  /** Funds have been locked and are awaiting settlement conditions. */
  ACTIVE = 'ACTIVE',
  /** Settlement is in progress (confirmation pending). */
  SETTLING = 'SETTLING',
  /** Settlement completed — funds released to counterparty. */
  SETTLED = 'SETTLED',
  /** Refund triggered — funds returned to the original depositor. */
  REFUNDED = 'REFUNDED',
  /** Dispute raised — escrow frozen pending admin resolution. */
  DISPUTED = 'DISPUTED',
  /** Escrow cancelled before funds were committed. */
  CANCELLED = 'CANCELLED',
}

/**
 * Settlement outcomes after an escrow has been fully processed.
 */
export enum SettlementResult {
  /** Full settlement — both sides completed. */
  FULL = 'FULL',
  /** Partial settlement — one or both sides partially filled. */
  PARTIAL = 'PARTIAL',
  /** No settlement occurred — full refund issued. */
  REFUND = 'REFUND',
  /** Dispute was raised and resolved by admin. */
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  /** Settlement failed due to system error — refund issued. */
  FAILED = 'FAILED',
}

/**
 * Reason codes for refund workflows — used in audit trails and
 * admin dashboards to categorize why a settlement didn't complete.
 */
export enum RefundReason {
  /** One side of the swap was cancelled or expired. */
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  /** The counterparty's order was cancelled or expired. */
  COUNTERPARTY_CANCELLED = 'COUNTERPARTY_CANCELLED',
  /** One or both orders expired before settlement. */
  TIMEOUT_EXPIRED = 'TIMEOUT_EXPIRED',
  /** Admin manually triggered a refund. */
  ADMIN_MANUAL = 'ADMIN_MANUAL',
  /** Dispute resolved in favour of the depositor. */
  DISPUTE_FAVOUR_DEPOSITOR = 'DISPUTE_FAVOUR_DEPOSITOR',
  /** System error during settlement attempt. */
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  /** Insufficient balance at settlement time. */
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  /** Partial fill — remaining escrowed amount refunded. */
  PARTIAL_FILL_REMAINING = 'PARTIAL_FILL_REMAINING',
}

/**
 * Reason codes for disputes — fed into the dispute hooks so that
 * downstream services can route and prioritise appropriately.
 */
export enum DisputeReason {
  /** Buyer claims non-delivery of goods/service. */
  NON_DELIVERY = 'NON_DELIVERY',
  /** Seller received payment but buyer disputes amount. */
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  /** Quality of delivered goods/services is disputed. */
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  /** Suspected fraud by one party. */
  SUSPECTED_FRAUD = 'SUSPECTED_FRAUD',
  /** Technical failure during settlement. */
  TECHNICAL_FAILURE = 'TECHNICAL_FAILURE',
  /** Other — free-text description required. */
  OTHER = 'OTHER',
}

/**
 * Direction of an escrow transaction movement.
 */
export enum EscrowTransactionType {
  /** Funds deposited into escrow. */
  DEPOSIT = 'DEPOSIT',
  /** Full release of escrowed funds to counterparty. */
  RELEASE = 'RELEASE',
  /** Partial release during partial settlement. */
  PARTIAL_RELEASE = 'PARTIAL_RELEASE',
  /** Full refund to the original depositor. */
  REFUND = 'REFUND',
  /** Partial refund during partial settlement. */
  PARTIAL_REFUND = 'PARTIAL_REFUND',
  /** Adjustment made by admin. */
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
}
