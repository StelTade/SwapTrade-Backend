export interface Trade {
  id: string;
  asset: string;
  quantity: number;
  price: number;
  side: 'BUY' | 'SELL';
  date: Date;
}

export interface PortfolioAnalytics {
  pnl: number;
  assetDistribution: Record<string, number>;
  riskScore: number;
}
