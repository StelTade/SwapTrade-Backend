import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get(':userId/portfolio')
  async getPortfolioStats(
    @Param('userId') userId: string,
  ): Promise<PortfolioStatsDto> {
    return this.userService.getPortfolioStats(userId);
  }
}