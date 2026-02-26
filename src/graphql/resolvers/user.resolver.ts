import { Resolver, Query, Args } from '@nestjs/graphql';
import { UserService } from '../../user/user.service';
import { PortfolioStatsDto } from '../../user/dto/portfolio-stats.dto';

@Resolver()
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => PortfolioStatsDto)
  userPortfolio(@Args('userId') userId: string) {
    return this.userService.getPortfolioStats(userId);
  }
}

