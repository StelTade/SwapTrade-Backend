
import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';

@ApiTags('user')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get(':userId/portfolio')
  @ApiOperation({ summary: 'Get user portfolio statistics', description: 'Returns portfolio statistics for a user. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Portfolio statistics retrieved successfully', type: PortfolioStatsDto })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  @ApiErrorResponses()
  async getPortfolioStats(
    @Param('userId') userId: string,
  ): Promise<PortfolioStatsDto> {
    return this.userService.getPortfolioStats(userId);
  }
}