/**
 * Strategy visibility controls whether a trader's profile, holdings and
 * trade feed are visible to other users. ACCEPTANCE CRITERION #4:
 * "Traders can choose to make their strategies private or public".
 */
export enum StrategyVisibility {
  /** Visible to everyone; appears on leaderboards and in search. */
  PUBLIC = 'PUBLIC',
  /** Visible only to existing subscribers and the trader themselves. */
  PRIVATE = 'PRIVATE',
  /** Visible to everyone but trade details are masked (only summary). */
  ANONYMOUS = 'ANONYMOUS',
}

/**
 * Lifecycle of a follower->master subscription. ACTIVE subscriptions
 * receive copy-trade events; PAUSED subscriptions don't (either paused
 * by the follower, or auto-paused by the risk-control service when a
 * daily loss limit is hit).
 */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  /** Auto-paused until the next UTC midnight by the risk-control cron. */
  PAUSED_DAILY_LOSS = 'PAUSED_DAILY_LOSS',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
}

/**
 * What kinds of master trades the follower is willing to copy. MARKET
 * is the default — LIMIT and conditional orders may not have liquidity
 * for followers with smaller balances, so followers can opt out.
 */
export enum CopyOrderTypeFilter {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
}

/**
 * Identifier-compatible primary-key type used by all social-trading
 * entities. Matches the JwtPayload.userId / User.id shape (string
 * UUID) instead of the legacy numeric userId used by Trade/Order/
 * UserBalance. We use parseInt() at service boundaries when we need
 * to match against the legacy numeric fields.
 */
export type UserId = string;
