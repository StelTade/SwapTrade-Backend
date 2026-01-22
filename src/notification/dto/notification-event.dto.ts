// Event payloads for type safety
export class TradeExecutedEvent {
  buyerId: string;
  sellerId: string;
  asset: string;
  amount: number;
  price: number;
  timestamp: Date;
  tradeId: string;

  constructor(data: TradeExecutedEvent) {
    Object.assign(this, data);
  }
}

export class BalanceUpdatedEvent {
  userId: string;
  asset: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  reason: string;
  timestamp: Date;

  constructor(data: BalanceUpdatedEvent) {
    Object.assign(this, data);
  }
}

export class PortfolioMilestoneEvent {
  userId: string;
  milestone: string;
  portfolioValue: number;
  previousValue: number;
  timestamp: Date;

  constructor(data: PortfolioMilestoneEvent) {
    Object.assign(this, data);
  }
}

// Event names as constants
export const EVENTS = {
  TRADE_EXECUTED: 'trade.executed',
  BALANCE_UPDATED: 'balance.updated',
  PORTFOLIO_MILESTONE: 'portfolio.milestone'
} as const;