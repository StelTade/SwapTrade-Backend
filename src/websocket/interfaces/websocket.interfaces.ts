export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}

export enum WebSocketMessageType {
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  
  // Authentication
  AUTH_REQUEST = 'auth_request',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  
  // Trading events
  ORDER_BOOK_UPDATE = 'order_book_update',
  TRADE_EXECUTED = 'trade_executed',
  ORDER_PLACED = 'order_placed',
  ORDER_CANCELLED = 'order_cancelled',
  ORDER_FILLED = 'order_filled',
  ORDER_PARTIALLY_FILLED = 'order_partially_filled',
  
  // Balance updates
  BALANCE_UPDATE = 'balance_update',
  PORTFOLIO_UPDATE = 'portfolio_update',
  
  // Market data
  MARKET_DATA_UPDATE = 'market_data_update',
  PRICE_TICK = 'price_tick',
  VOLUME_UPDATE = 'volume_update',
  
  // User-specific events
  USER_TRADE_EXECUTED = 'user_trade_executed',
  USER_ORDER_UPDATE = 'user_order_update',
  USER_ACHIEVEMENT_UNLOCKED = 'user_achievement_unlocked',
  USER_TIER_PROGRESS = 'user_tier_progress',
  
  // System events
  SYSTEM_STATUS = 'system_status',
  MAINTENANCE_NOTICE = 'maintenance_notice'
}

export interface WebSocketClient {
  id: string;
  userId?: string;
  sessionId: string;
  socket: any;
  subscriptions: Set<string>;
  authenticated: boolean;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface SubscriptionRequest {
  channels: string[];
  filters?: Record<string, any>;
}

export interface OrderBookUpdate {
  asset: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: string;
  sequence: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  count: number;
}

export interface TradeExecuted {
  id: string;
  asset: string;
  amount: number;
  price: number;
  type: 'buy' | 'sell';
  timestamp: string;
  buyerId: string;
  sellerId: string;
  fee: number;
}

export interface OrderUpdate {
  id: string;
  userId: string;
  asset: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  filled: number;
  remaining: number;
  status: 'pending' | 'filled' | 'cancelled' | 'partially_filled';
  timestamp: string;
}

export interface BalanceUpdate {
  userId: string;
  asset: string;
  balance: number;
  available: number;
  locked: number;
  timestamp: string;
}

export interface PortfolioUpdate {
  userId: string;
  totalValue: number;
  assets: PortfolioAsset[];
  timestamp: string;
}

export interface PortfolioAsset {
  asset: string;
  balance: number;
  value: number;
  price: number;
  change24h: number;
}

export interface MarketDataUpdate {
  asset: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: string;
}

export interface WebSocketAuthData {
  token: string;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketConfig {
  port: number;
  path: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  heartbeat: {
    interval: number;
    timeout: number;
  };
  rateLimit: {
    maxConnections: number;
    maxMessagesPerSecond: number;
  };
  compression: boolean;
  maxPayloadSize: number;
}
