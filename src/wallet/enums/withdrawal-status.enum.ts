/**
 * Lifecycle of a withdrawal request.
 *
 * Happy path: QUEUED → PROCESSING → SENT → COMPLETED.
 * High-value requests start at PENDING_APPROVAL and only enter QUEUED once an
 * admin approves them. Terminal states are COMPLETED, FAILED, REJECTED and
 * CANCELLED.
 */
export enum WithdrawalStatus {
  /** Above the approval threshold — waiting for an admin decision. */
  PENDING_APPROVAL = 'pending_approval',
  /** Reserved and ready for the processor to broadcast. */
  QUEUED = 'queued',
  /** Claimed by the processor; broadcast in flight. */
  PROCESSING = 'processing',
  /** Broadcast succeeded; waiting for on-chain confirmations. */
  SENT = 'sent',
  /** Confirmed on-chain; reserved funds have been debited. */
  COMPLETED = 'completed',
  /** Broadcast or processing failed; reserved funds released. */
  FAILED = 'failed',
  /** Admin rejected the request; reserved funds released. */
  REJECTED = 'rejected',
  /** User cancelled before broadcast; reserved funds released. */
  CANCELLED = 'cancelled',
}
