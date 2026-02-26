import { IsString, IsNumber, IsDate, Min, IsPositive } from 'class-validator';
import { IsAssetType } from '../../common/validation';

// Event payloads for type safety
export class TradeExecutedEvent {
  @IsString()
  buyerId: string;

  @IsString()
  sellerId: string;

  @IsAssetType()
  asset: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsDate()
  timestamp: Date;

  @IsString()
  tradeId: string;

  constructor(data: TradeExecutedEvent) {
    Object.assign(this, data);
  }
}

export class BalanceUpdatedEvent {
  @IsString()
  userId: string;

  @IsAssetType()
  asset: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  @Min(0)
  previousBalance: number;

  @IsNumber()
  @Min(0)
  newBalance: number;

  @IsString()
  reason: string;

  @IsDate()
  timestamp: Date;

  constructor(data: BalanceUpdatedEvent) {
    Object.assign(this, data);
  }
}

export class PortfolioMilestoneEvent {
  @IsString()
  userId: string;

  @IsString()
  milestone: string;

  @IsNumber()
  @Min(0)
  portfolioValue: number;

  @IsNumber()
  @Min(0)
  previousValue: number;

  @IsDate()
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