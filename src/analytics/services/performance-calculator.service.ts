import { Injectable, Logger } from '@nestjs/common';
import { Trade } from '../trading/entities/trade.entity';
import { PerformanceMetrics, PerformanceDataPoint } from '../interfaces/analytics.interfaces';

@Injectable()
export class PerformanceCalculatorService {
  private readonly logger = new Logger(PerformanceCalculatorService.name);

  calculatePerformanceMetrics(trades: Trade[], initialValue: number = 100000): PerformanceMetrics {
    if (!trades || trades.length === 0) {
      return this.getDefaultMetrics();
    }

    // Sort trades by timestamp
    const sortedTrades = trades.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate returns
    const returns = this.calculateReturns(sortedTrades, initialValue);
    const dailyReturns = this.calculateDailyReturns(sortedTrades);

    // Basic metrics
    const totalReturn = this.calculateTotalReturn(sortedTrades, initialValue);
    const volatility = this.calculateVolatility(dailyReturns);
    const sharpeRatio = this.calculateSharpeRatio(totalReturn, volatility);
    const maxDrawdown = this.calculateMaxDrawdown(sortedTrades, initialValue);

    // Advanced metrics
    const alpha = this.calculateAlpha(sortedTrades);
    const beta = this.calculateBeta(sortedTrades);
    const informationRatio = this.calculateInformationRatio(sortedTrades);
    const sortinoRatio = this.calculateSortinoRatio(dailyReturns);
    const calmarRatio = this.calculateCalmarRatio(totalReturn, maxDrawdown);

    // Trade statistics
    const winningTrades = sortedTrades.filter(trade => trade.pnl && trade.pnl > 0);
    const losingTrades = sortedTrades.filter(trade => trade.pnl && trade.pnl < 0);

    const winRate = winningTrades.length / sortedTrades.length;
    const profitFactor = this.calculateProfitFactor(winningTrades, losingTrades);
    const averageWin = this.calculateAverageWin(winningTrades);
    const averageLoss = this.calculateAverageLoss(losingTrades);
    const largestWin = this.calculateLargestWin(winningTrades);
    const largestLoss = this.calculateLargestLoss(losingTrades);

    // Streak metrics
    const consecutiveWins = this.calculateConsecutiveWins(sortedTrades);
    const consecutiveLosses = this.calculateConsecutiveLosses(sortedTrades);

    return {
      totalReturn,
      annualizedReturn: this.annualizeReturn(totalReturn, sortedTrades.length),
      volatility,
      sharpeRatio,
      maxDrawdown,
      alpha,
      beta,
      informationRatio,
      sortinoRatio,
      calmarRatio,
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      consecutiveWins,
      consecutiveLosses
    };
  }

  calculateHistoricalPerformance(trades: Trade[], period: string): PerformanceDataPoint[] {
    const sortedTrades = trades.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const days = this.getPeriodDays(period);
    const dataPoints: PerformanceDataPoint[] = [];
    
    let currentValue = 100000; // Starting value
    let cumulativeReturn = 0;
    let runningMax = currentValue;

    // Generate daily data points
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));

      // Get trades for this day
      const dayTrades = sortedTrades.filter(trade => 
        this.isSameDay(new Date(trade.timestamp), date)
      );

      // Calculate daily return
      const dailyReturn = dayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / currentValue;
      
      currentValue += dayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      cumulativeReturn = (currentValue - 100000) / 100000;
      runningMax = Math.max(runningMax, currentValue);
      const drawdown = (runningMax - currentValue) / runningMax;

      // Calculate rolling volatility (30-day)
      const rollingVolatility = this.calculateRollingVolatility(dataPoints, 30);

      dataPoints.push({
        date: date.toISOString(),
        value: currentValue,
        return: dailyReturn,
        cumulativeReturn,
        drawdown,
        volatility: rollingVolatility
      });
    }

    return dataPoints;
  }

  calculateBenchmarkComparison(portfolioData: PerformanceDataPoint[], benchmarkData: PerformanceDataPoint[]) {
    if (portfolioData.length === 0 || benchmarkData.length === 0) {
      return this.getDefaultBenchmarkComparison();
    }

    const portfolioReturns = portfolioData.map(point => point.return);
    const benchmarkReturns = benchmarkData.map(point => point.return);

    const portfolioTotalReturn = portfolioData[portfolioData.length - 1].cumulativeReturn;
    const benchmarkTotalReturn = benchmarkData[benchmarkData.length - 1].cumulativeReturn;

    const alpha = this.calculateAlphaFromReturns(portfolioReturns, benchmarkReturns);
    const beta = this.calculateBetaFromReturns(portfolioReturns, benchmarkReturns);
    const correlation = this.calculateCorrelation(portfolioReturns, benchmarkReturns);
    const trackingError = this.calculateTrackingError(portfolioReturns, benchmarkReturns);
    const informationRatio = trackingError > 0 ? alpha / trackingError : 0;

    // Calculate up/down capture
    const upCapture = this.calculateUpCapture(portfolioReturns, benchmarkReturns);
    const downCapture = this.calculateDownCapture(portfolioReturns, benchmarkReturns);

    return {
      benchmark: 'XLM', // Default benchmark
      portfolioReturn: portfolioTotalReturn,
      benchmarkReturn: benchmarkTotalReturn,
      alpha,
      beta,
      correlation,
      trackingError,
      informationRatio,
      upCapture,
      downCapture
    };
  }

  private calculateReturns(trades: Trade[], initialValue: number): number[] {
    const returns: number[] = [];
    let currentValue = initialValue;

    for (const trade of trades) {
      if (trade.pnl) {
        const returnRate = trade.pnl / currentValue;
        returns.push(returnRate);
        currentValue += trade.pnl;
      }
    }

    return returns;
  }

  private calculateDailyReturns(trades: Trade[]): number[] {
    const dailyReturns: Map<string, number> = new Map();

    for (const trade of trades) {
      const date = new Date(trade.timestamp).toDateString();
      const currentReturn = dailyReturns.get(date) || 0;
      
      if (trade.pnl) {
        dailyReturns.set(date, currentReturn + trade.pnl);
      }
    }

    return Array.from(dailyReturns.values());
  }

  private calculateTotalReturn(trades: Trade[], initialValue: number): number {
    const totalPnl = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    return totalPnl / initialValue;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateSharpeRatio(totalReturn: number, volatility: number, riskFreeRate: number = 0.02): number {
    if (volatility === 0) return 0;
    return (totalReturn - riskFreeRate) / volatility;
  }

  private calculateMaxDrawdown(trades: Trade[], initialValue: number): number {
    let maxDrawdown = 0;
    let peak = initialValue;
    let currentValue = initialValue;

    for (const trade of trades) {
      if (trade.pnl) {
        currentValue += trade.pnl;
        peak = Math.max(peak, currentValue);
        const drawdown = (peak - currentValue) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown;
  }

  private calculateAlpha(trades: Trade[]): number {
    // Simplified alpha calculation (would normally use benchmark data)
    const totalReturn = this.calculateTotalReturn(trades, 100000);
    const marketReturn = 0.08; // Assumed market return
    const beta = 1.0; // Assumed beta
    const riskFreeRate = 0.02;

    return totalReturn - (riskFreeRate + beta * (marketReturn - riskFreeRate));
  }

  private calculateBeta(trades: Trade[]): number {
    // Simplified beta calculation (would normally use covariance with market)
    return 1.0; // Default beta
  }

  private calculateInformationRatio(trades: Trade[]): number {
    // Simplified information ratio
    const alpha = this.calculateAlpha(trades);
    const trackingError = 0.12; // Assumed tracking error
    
    return trackingError > 0 ? alpha / trackingError : 0;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const negativeReturns = returns.filter(ret => ret < 0);
    
    if (negativeReturns.length === 0) return 0;

    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / negativeReturns.length
    );

    return downsideDeviation > 0 ? mean / downsideDeviation : 0;
  }

  private calculateCalmarRatio(totalReturn: number, maxDrawdown: number): number {
    return maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
  }

  private calculateProfitFactor(winningTrades: Trade[], losingTrades: Trade[]): number {
    const grossProfit = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));

    return grossLoss > 0 ? grossProfit / grossLoss : 0;
  }

  private calculateAverageWin(winningTrades: Trade[]): number {
    if (winningTrades.length === 0) return 0;
    const totalWin = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    return totalWin / winningTrades.length;
  }

  private calculateAverageLoss(losingTrades: Trade[]): number {
    if (losingTrades.length === 0) return 0;
    const totalLoss = losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    return Math.abs(totalLoss / losingTrades.length);
  }

  private calculateLargestWin(winningTrades: Trade[]): number {
    if (winningTrades.length === 0) return 0;
    return Math.max(...winningTrades.map(trade => trade.pnl || 0));
  }

  private calculateLargestLoss(losingTrades: Trade[]): number {
    if (losingTrades.length === 0) return 0;
    return Math.min(...losingTrades.map(trade => trade.pnl || 0));
  }

  private calculateConsecutiveWins(trades: Trade[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const trade of trades) {
      if (trade.pnl && trade.pnl > 0) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  private calculateConsecutiveLosses(trades: Trade[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const trade of trades) {
      if (trade.pnl && trade.pnl < 0) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }

  private annualizeReturn(totalReturn: number, tradeCount: number): number {
    // Assuming 252 trading days per year
    const daysInYear = 252;
    const years = tradeCount / daysInYear;
    
    return years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : totalReturn;
  }

  private getPeriodDays(period: string): number {
    const periods = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365
    };

    return periods[period] || 30;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  private calculateRollingVolatility(dataPoints: PerformanceDataPoint[], window: number): number {
    if (dataPoints.length < window) return 0;

    const recentReturns = dataPoints.slice(-window).map(point => point.return);
    return this.calculateVolatility(recentReturns);
  }

  private calculateAlphaFromReturns(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;

    const portfolioMean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkReturns.length;

    return portfolioMean - benchmarkMean;
  }

  private calculateBetaFromReturns(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 1;

    const portfolioMean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkReturns.length;

    let covariance = 0;
    let variance = 0;

    for (let i = 0; i < portfolioReturns.length; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioMean;
      const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
      
      covariance += portfolioDiff * benchmarkDiff;
      variance += benchmarkDiff * benchmarkDiff;
    }

    return variance > 0 ? covariance / variance : 1;
  }

  private calculateCorrelation(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;

    const portfolioMean = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
    const benchmarkMean = benchmarkReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkReturns.length;

    let covariance = 0;
    let portfolioVariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < portfolioReturns.length; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioMean;
      const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
      
      covariance += portfolioDiff * benchmarkDiff;
      portfolioVariance += portfolioDiff * portfolioDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }

    const portfolioStd = Math.sqrt(portfolioVariance);
    const benchmarkStd = Math.sqrt(benchmarkVariance);

    return (portfolioStd * benchmarkStd) > 0 ? covariance / (portfolioStd * benchmarkStd) : 0;
  }

  private calculateTrackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;

    const excessReturns = portfolioReturns.map((ret, i) => ret - benchmarkReturns[i]);
    return this.calculateVolatility(excessReturns);
  }

  private calculateUpCapture(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const upPeriods = benchmarkReturns
      .map((ret, i) => ({ portfolio: portfolioReturns[i], benchmark: ret }))
      .filter(({ benchmark }) => benchmark > 0);

    if (upPeriods.length === 0) return 0;

    const portfolioUpReturn = upPeriods.reduce((sum, { portfolio }) => sum + portfolio, 0);
    const benchmarkUpReturn = upPeriods.reduce((sum, { benchmark }) => sum + benchmark, 0);

    return benchmarkUpReturn > 0 ? portfolioUpReturn / benchmarkUpReturn : 0;
  }

  private calculateDownCapture(portfolioReturns: number[], benchmarkReturns: number[]): number {
    const downPeriods = benchmarkReturns
      .map((ret, i) => ({ portfolio: portfolioReturns[i], benchmark: ret }))
      .filter(({ benchmark }) => benchmark < 0);

    if (downPeriods.length === 0) return 0;

    const portfolioDownReturn = downPeriods.reduce((sum, { portfolio }) => sum + portfolio, 0);
    const benchmarkDownReturn = downPeriods.reduce((sum, { benchmark }) => sum + benchmark, 0);

    return benchmarkDownReturn < 0 ? portfolioDownReturn / Math.abs(benchmarkDownReturn) : 0;
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      alpha: 0,
      beta: 0,
      informationRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0
    };
  }

  private getDefaultBenchmarkComparison() {
    return {
      benchmark: 'XLM',
      portfolioReturn: 0,
      benchmarkReturn: 0,
      alpha: 0,
      beta: 0,
      correlation: 0,
      trackingError: 0,
      informationRatio: 0,
      upCapture: 0,
      downCapture: 0
    };
  }
}
