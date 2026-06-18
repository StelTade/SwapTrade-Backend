import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/user-status.dto';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiErrorResponses } from '../common/decorators/swagger-error-responses.decorator';
import { AccountStatus } from '../auth/entities/auth.entity';

@ApiTags('identity/user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('identity/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Current User Profile ──────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiErrorResponses()
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.userService.findOne(user.userId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiErrorResponses()
  updateMyProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    // Users can only update non-role fields from this endpoint
    const { role, roles, ...safeUpdate } = dto;
    return this.userService.update(user.userId, safeUpdate);
  }

  // ─── Portfolio ─────────────────────────────────────────────────────────────

  @Get('me/portfolio')
  @ApiOperation({ summary: 'Get portfolio statistics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Portfolio statistics', type: PortfolioStatsDto })
  @ApiErrorResponses()
  async getMyPortfolioStats(@CurrentUser() user: JwtPayload): Promise<PortfolioStatsDto> {
    return this.userService.getPortfolioStats(user.userId);
  }

  @Get(':userId/portfolio')
  @ApiOperation({ summary: 'Get portfolio statistics by user ID' })
  @ApiResponse({ status: 200, description: 'Portfolio statistics retrieved successfully', type: PortfolioStatsDto })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  @ApiErrorResponses()
  async getPortfolioStats(@Param('userId') userId: string): Promise<PortfolioStatsDto> {
    return this.userService.getPortfolioStats(userId);
  }

  // ─── Admin: User Management ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: '[Admin] List all users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  @ApiErrorResponses()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Get user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiErrorResponses()
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '[Admin] Update user profile and roles' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiErrorResponses()
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  // ─── Status Management ─────────────────────────────────────────────────────

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Update user account status' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiErrorResponses()
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.userService.updateStatus(id, dto);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Activate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Account activated' })
  activate(@Param('id') id: string) {
    return this.userService.activate(id);
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Suspend a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Account suspended' })
  suspend(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.userService.suspend(id, body.reason);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  deactivate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.userService.deactivate(id, body.reason);
  }
}
