import { Resolver, Query, Args } from '@nestjs/graphql';
import { AdvancedAnalyticsService } from '../../advanced-analytics/advanced-analytics.service';

@Resolver()
export class AdvancedAnalyticsResolver {
  constructor(
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
  ) {}

  @Query(() => Object)
  async advancedRiskMetrics(@Args('userId') userId: string): Promise<any> {
    return this.advancedAnalyticsService.getAdvancedRiskMetrics(userId);
  }

  @Query(() => Object)
  async portfolioOptimization(@Args('userId') userId: string): Promise<any> {
    return this.advancedAnalyticsService.getPortfolioOptimization(userId);
  }
}
