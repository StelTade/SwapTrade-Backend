import { Resolver, Query, Args } from '@nestjs/graphql';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { PortfolioAnalytics } from '../../common/interfaces/portfolio.interface';

@Resolver()
export class PortfolioResolver {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Query(() => Object)
  portfolioAnalytics(@Args('userId') userId: string): Promise<PortfolioAnalytics> {
    return this.portfolioService.getAnalytics(userId);
  }
}

