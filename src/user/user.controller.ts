import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get(':userId/portfolio')
  @ApiOperation({ summary: 'Get user portfolio statistics' })
  @ApiResponse({ status: 200, description: 'Portfolio statistics retrieved successfully', type: PortfolioStatsDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  async getPortfolioStats(
    @Param('userId') userId: string,
  ): Promise<PortfolioStatsDto> {
    return this.userService.getPortfolioStats(userId);
  }
}