export class PortfolioStatsDto {
    userId: string;
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