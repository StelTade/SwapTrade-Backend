import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { PortfolioLoader } from '../loaders/portfolio.loader';
import { PortfolioAnalytics } from '../../common/interfaces/portfolio.interface';

@Resolver()
export class OptimizedPortfolioResolver {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly portfolioLoader: PortfolioLoader,
  ) {}

  @Query(() => Object)
  async portfolioAnalytics(
    @Args('userId') userId: string,
    @Context() context: { req: any },
  ): Promise<PortfolioAnalytics> {
    const startTime = process.memoryUsage();

    try {
      // Use DataLoader for batching and caching
      const analytics =
        await this.portfolioLoader.portfolioAnalyticsLoader.load(userId);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
        external: endTime.external - startTime.external,
      };

      console.log(`Portfolio analytics memory usage:`, {
        userId,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(endTime.heapTotal / 1024 / 1024),
      });

      return analytics;
    } catch (error) {
      console.error(`Portfolio analytics error for user ${userId}:`, error);
      throw error;
    }
  }

  @Query(() => Object)
  async portfolioSummary(
    @Args('userId') userId: string,
    @Context() context: { req: any },
  ) {
    const startTime = process.memoryUsage();

    try {
      const summary =
        await this.portfolioLoader.portfolioSummaryLoader.load(userId);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Portfolio summary memory usage:`, {
        userId,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return summary;
    } catch (error) {
      console.error(`Portfolio summary error for user ${userId}:`, error);
      throw error;
    }
  }

  @Query(() => Object)
  async portfolioRisk(
    @Args('userId') userId: string,
    @Context() context: { req: any },
  ) {
    const startTime = process.memoryUsage();

    try {
      const risk = await this.portfolioLoader.portfolioRiskLoader.load(userId);

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Portfolio risk memory usage:`, {
        userId,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return risk;
    } catch (error) {
      console.error(`Portfolio risk error for user ${userId}:`, error);
      throw error;
    }
  }

  @Query(() => Object)
  async portfolioPerformance(
    @Args('userId') userId: string,
    @Args('startDate', { nullable: true }) startDate: string | undefined,
    @Args('endDate', { nullable: true }) endDate: string | undefined,
    @Context() context: { req: any },
  ) {
    const startTime = process.memoryUsage();

    try {
      const performance =
        await this.portfolioLoader.portfolioPerformanceLoader.load({
          userId,
          startDate,
          endDate,
        });

      const endTime = process.memoryUsage();
      const memoryDelta = {
        rss: endTime.rss - startTime.rss,
        heapUsed: endTime.heapUsed - startTime.heapUsed,
        heapTotal: endTime.heapTotal - startTime.heapTotal,
      };

      console.log(`Portfolio performance memory usage:`, {
        userId,
        memoryDelta,
        heapUsedMB: Math.round(endTime.heapUsed / 1024 / 1024),
      });

      return performance;
    } catch (error) {
      console.error(`Portfolio performance error for user ${userId}:`, error);
      throw error;
    }
  }
}
