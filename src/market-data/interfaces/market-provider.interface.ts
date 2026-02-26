export interface MarketDataProvider {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeToPairs(pairs: string[]): Promise<void>;
  unsubscribeFromPairs(pairs: string[]): Promise<void>;
  isConnected(): boolean;
  onPriceUpdate(callback: (data: PriceUpdate) => void): void;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  volume?: number;
  timestamp: Date;
  source: string;
}

export interface MarketDataConfig {
  providers: {
    name: string;
    type: 'rest' | 'websocket';
    url: string;
    apiKey?: string;
    pairs: string[];
    updateInterval?: number;
  }[];
  fallbackProviders: string[];
  maxRetries: number;
  retryDelay: number;
}
