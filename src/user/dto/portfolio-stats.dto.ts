export class PortfolioStatsDto {
    userId: number;
    totalTrades: number;
    cumulativePnL: number;
    totalTradeVolume: number;
    lastTradeDate: Date | null;
    currentBalances: Array<{
        asset: string;
        amount: number;
        trades: number;
        pnl: number;
    }>;
}