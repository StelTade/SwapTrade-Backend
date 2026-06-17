import { Injectable } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { PortfolioAnalytics } from '../../common/interfaces/portfolio.interface';
import { PortfolioService } from '../../portfolio/portfolio.service';

@Injectable()
export class PortfolioLoader {
  constructor(private readonly portfolioService: PortfolioService) {}

  /**
   * DataLoader for portfolio analytics - batches analytics requests
   * Reduces memory usage by batching portfolio calculations
   */
  readonly portfolioAnalyticsLoader = new DataLoader(
    async (userIds: readonly string[]) => {
      const startTime = Date.now();

      // Batch fetch analytics for all users
      const analyticsPromises = userIds.map((userId) =>
        this.portfolioService.getAnalytics(userId),
      );

      const analyticsResults = await Promise.all(analyticsPromises);

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded portfolio analytics for ${userIds.length} users in ${duration}ms`,
      );

      return analyticsResults;
    },
  );

  /**
   * DataLoader for portfolio summaries - batches summary requests
   * Optimizes memory usage for portfolio summary calculations
   */
  readonly portfolioSummaryLoader = new DataLoader(
    async (userIds: readonly string[]) => {
      const startTime = Date.now();

      // Batch fetch summaries with controlled concurrency
      const batchSize = 10; // Process in batches to control memory
      const results: any[] = [];

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const batchPromises = batch.map((userId) =>
          this.portfolioService.getPortfolioSummary(userId),
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Allow garbage collection between batches
        if (i + batchSize < userIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded portfolio summaries for ${userIds.length} users in ${duration}ms`,
      );

      return results;
    },
  );

  /**
   * DataLoader for portfolio risk metrics - batches risk calculations
   */
  readonly portfolioRiskLoader = new DataLoader(
    async (userIds: readonly string[]) => {
      const startTime = Date.now();

      const riskPromises = userIds.map((userId) =>
        this.portfolioService.getPortfolioRisk(userId),
      );

      const riskResults = await Promise.all(riskPromises);

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded portfolio risk for ${userIds.length} users in ${duration}ms`,
      );

      return riskResults;
    },
  );

  /**
   * DataLoader for portfolio performance - batches performance calculations
   */
  readonly portfolioPerformanceLoader = new DataLoader(
    async (
      requests: readonly {
        userId: string;
        startDate?: string;
        endDate?: string;
      }[],
    ) => {
      const startTime = Date.now();

      const performancePromises = requests.map((request) =>
        this.portfolioService.getPortfolioPerformance(
          request.userId,
          request.startDate,
          request.endDate,
        ),
      );

      const performanceResults = await Promise.all(performancePromises);

      const duration = Date.now() - startTime;
      console.log(
        `Batch loaded portfolio performance for ${requests.length} users in ${duration}ms`,
      );

      return performanceResults;
    },
  );

  /**
   * Clear cache for specific user portfolio
   */
  clearUserPortfolio(userId: string): void {
    this.portfolioAnalyticsLoader.clear(userId);
    this.portfolioSummaryLoader.clear(userId);
    this.portfolioRiskLoader.clear(userId);
  }

  /**
   * Clear all portfolio caches
   */
  clearAll(): void {
    this.portfolioAnalyticsLoader.clearAll();
    this.portfolioSummaryLoader.clearAll();
    this.portfolioRiskLoader.clearAll();
    this.portfolioPerformanceLoader.clearAll();
  }
}
