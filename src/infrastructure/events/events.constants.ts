/**
 * Event Constants
 * Centralized event names for type-safe event handling
 */

export const EVENTS = {
  // User events
  USER: {
    CREATED: 'user.created',
    UPDATED: 'user.updated',
  },
  
  // Balance events
  BALANCE: {
    UPDATED: 'balance.updated',
    RECALCULATION_REQUESTED: 'balance.recalculation-requested',
    RECALCULATED: 'balance.recalculated',
  },
  
  // Trading events
  TRADING: {
    ORDER_CREATED: 'trading.order-created',
    ORDER_COMPLETED: 'trading.order-completed',
    TRADE_EXECUTED: 'trading.trade-executed',
  },
  
  // Portfolio events
  PORTFOLIO: {
    UPDATED: 'portfolio.updated',
    REBALANCED: 'portfolio.rebalanced',
  },
  
  // Risk events
  RISK: {
    ASSESSMENT_REQUESTED: 'risk.assessment-requested',
    ASSESSMENT_COMPLETED: 'risk.assessment-completed',
  },
  
  // Rewards events
  REWARDS: {
    EARNED: 'reward.earned',
    ALLOCATED: 'reward.allocated',
  },
  
  // Queue events
  QUEUE: {
    JOB_ENQUEUED: 'queue.job-enqueued',
    JOB_COMPLETED: 'queue.job-completed',
  },
  
  // Swap events
  SWAP: {
    SETTLEMENT_REQUESTED: 'swap.settlement-requested',
    SETTLED: 'swap.settled',
  },
};
