/**
 * Domain Events
 * Events emitted by services to notify other modules of state changes
 * Eliminates circular dependencies through pub/sub pattern
 */

// ─── Identity Domain Events ────────────────────────────────────────────────────

export class UserRegisteredEvent {
  constructor(
    public authId: string,
    public userId: string,
    public email: string,
    public correlationId?: string,
  ) {}
}

export class UserLoggedInEvent {
  constructor(
    public authId: string,
    public userId: string,
    public email: string,
    public ipAddress?: string,
  ) {}
}

export class UserLoggedOutEvent {
  constructor(
    public authId: string,
    public userId: string | undefined,
    public email: string,
  ) {}
}

export class PasswordChangedEvent {
  constructor(
    public authId: string,
    public email: string,
  ) {}
}

export class PasswordResetRequestedEvent {
  constructor(
    public authId: string,
    public email: string,
    public resetToken: string,
  ) {}
}

export class AccountLockedEvent {
  constructor(
    public authId: string,
    public email: string,
    public lockedUntil: Date,
  ) {}
}

export class UserStatusChangedEvent {
  constructor(
    public userId: string,
    public email: string,
    public previousStatus: string,
    public newStatus: string,
    public reason?: string,
  ) {}
}

// ─── Legacy User Domain Events (keep for backward-compat) ─────────────────────

export class UserCreatedEvent {
  constructor(public userId: string, public email: string) {}
}

export class UserUpdatedEvent {
  constructor(
    public userId: string,
    public data: Record<string, unknown>,
  ) {}
}

// Balance Domain Events
export class BalanceUpdatedEvent {
  constructor(
    public userId: string,
    public currency: string,
    public amount: number,
    public previousAmount: number,
  ) {}
}

export class BalanceRecalculationRequestedEvent {
  constructor(
    public userId: string,
    public source: 'trading' | 'portfolio' | 'manual',
  ) {}
}

export class BalanceRecalculatedEvent {
  constructor(public userId: string, public totalValue: number) {}
}

// Trading Domain Events
export class OrderCreatedEvent {
  constructor(
    public orderId: string,
    public userId: string,
    public type: 'buy' | 'sell',
    public amount: number,
  ) {}
}

export class OrderCompletedEvent {
  constructor(
    public orderId: string,
    public userId: string,
    public balanceDelta: number,
  ) {}
}

export class TradeExecutedEvent {
  constructor(
    public tradeId: string,
    public userId: string,
    public value: number,
  ) {}
}

// Portfolio Domain Events
export class PortfolioUpdatedEvent {
  constructor(
    public userId: string,
    public assets: unknown[],
    public totalValue: number,
  ) {}
}

export class PortfolioRebalancedEvent {
  constructor(public userId: string, public newAllocation: unknown) {}
}

// Risk Domain Events
export class RiskAssessmentRequestedEvent {
  constructor(
    public portfolioId: string,
    public portfolioData: unknown,
  ) {}
}

export class RiskAssessmentCompletedEvent {
  constructor(
    public portfolioId: string,
    public assessment: unknown,
  ) {}
}

// Rewards Domain Events
export class RewardEarnedEvent {
  constructor(
    public userId: string,
    public amount: number,
    public source: 'trading' | 'referral' | 'loyalty',
  ) {}
}

export class RewardAllocatedEvent {
  constructor(
    public userId: string,
    public amount: number,
    public type: string,
  ) {}
}

// Queue Domain Events
export class JobEnqueuedEvent {
  constructor(
    public jobName: string,
    public jobId: string,
    public data: unknown,
  ) {}
}

export class JobCompletedEvent {
  constructor(
    public jobName: string,
    public jobId: string,
    public result: unknown,
  ) {}
}

// Swap Settlement Events
export class SwapSettlementRequestedEvent {
  constructor(
    public swapId: string,
    public userId: string,
    public status: string,
  ) {}
}

export class SwapSettledEvent {
  constructor(
    public swapId: string,
    public userId: string,
    public finalAmount: number,
  ) {}
}
