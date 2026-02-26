export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LIMIT = 'STOP_LIMIT',
  STOP_MARKET = 'STOP_MARKET',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
  DAY = 'DAY', // Day order
}

export interface Order {
  id: string;
  userId: string;
  asset: string;
  side: OrderSide;
  type: OrderType;
  price?: number; // undefined for market orders
  stopPrice?: number; // for stop orders
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  timeInForce: TimeInForce;
  timestamp: Date;
  priority: number; // calculated priority for matching
  status: OrderStatus;
  metadata?: Record<string, any>;
}

export interface MatchResult {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  timestamp: Date;
  buyerFee: number;
  sellerFee: number;
}

export interface MatchingStats {
  ordersProcessed: number;
  matchesExecuted: number;
  totalVolume: number;
  averageMatchTime: number;
  queueDepth: number;
  rejectedOrders: number;
}
