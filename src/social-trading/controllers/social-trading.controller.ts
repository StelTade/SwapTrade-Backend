import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../auth/guards/jwt-auth.guard';
import { SocialTradingService } from '../services/social-trading.service';
import { LeaderboardService } from '../services/leaderboard.service';
import {
  CreateCopySubscriptionDto,
  CreateTraderProfileDto,
  LeaderboardEntryDto,
  SocialFeedEntryDto,
  TraderProfileResponseDto,
  UpdateCopySubscriptionDto,
  UpdateTraderProfileDto,
} from '../dto/social-trading.dto';
import { CopySubscription } from '../entities/copy-subscription.entity';
import { ApiErrorResponses } from '../../common/decorators/swagger-error-responses.decorator';

/**
 * REST surface for SocialTradingModule. Routes are organized around
 * the canonical resource pair (Profile, Subscription), plus the two
 * engagement surfaces (Leaderboard, SocialFeed).
 *
 * Authentication: every route is behind JwtAuthGuard, matching the
 * pattern used by OrdersController and UserController. The public
 * leaderboard endpoint is intentionally NOT public — sorted output
 * without auth would let unauthenticated visitors scrape user IDs
 * and trade history.
 */
@ApiTags('social-trading')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('social-trading')
export class SocialTradingController {
  constructor(
    private readonly socialTradingService: SocialTradingService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  // ─── Trader Profile ──────────────────────────────────────────────────

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a trader profile for the authenticated user',
  })
  @ApiResponse({ status: 201, description: 'Profile created' })
  @ApiErrorResponses()
  createMyProfile(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateTraderProfileDto,
  ): Promise<TraderProfileResponseDto> {
    return this.socialTradingService.createProfile(req.user.userId, dto);
  }

  @Patch('profiles/me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiErrorResponses()
  updateMyProfile(
    @Req() req: { user: JwtPayload },
    @Body() dto: UpdateTraderProfileDto,
  ): Promise<TraderProfileResponseDto> {
    return this.socialTradingService.updateProfile(req.user.userId, dto);
  }

  @Get('profiles/me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiErrorResponses()
  getMyProfile(
    @Req() req: { user: JwtPayload },
  ): Promise<TraderProfileResponseDto | null> {
    return this.socialTradingService.getProfile(req.user.userId);
  }

  @Get('profiles/:userId')
  @ApiOperation({ summary: 'Get a trader profile by user id' })
  @ApiParam({ name: 'userId', description: 'Trader user id (UUID)' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiErrorResponses()
  async getProfile(
    @Param('userId') userId: string,
  ): Promise<TraderProfileResponseDto> {
    const profile = await this.socialTradingService.getProfile(userId);
    if (!profile) {
      throw new NotFoundException(`No profile for user ${userId}`);
    }
    return profile;
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List public trader profiles' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Profile list returned' })
  @ApiErrorResponses()
  listPublicProfiles(
    @Query('limit') limit?: string,
  ): Promise<TraderProfileResponseDto[]> {
    const parsed = limit ? parseInt(limit, 10) : 20;
    const safeLimit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 20;
    return this.socialTradingService.listPublicProfiles(safeLimit);
  }

  // ─── Copy Subscriptions ──────────────────────────────────────────────

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subscribe to a master trader (start copy-trading)',
  })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  @ApiErrorResponses()
  subscribe(
    @Req() req: { user: JwtPayload },
    @Body() dto: CreateCopySubscriptionDto,
  ): Promise<CopySubscription> {
    return this.socialTradingService.subscribe(req.user.userId, dto);
  }

  @Patch('subscriptions/:subscriptionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing copy subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  @ApiErrorResponses()
  updateSubscription(
    @Req() req: { user: JwtPayload },
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateCopySubscriptionDto,
  ): Promise<CopySubscription> {
    return this.socialTradingService.updateSubscription(
      req.user.userId,
      subscriptionId,
      dto,
    );
  }

  @Patch('subscriptions/:subscriptionId/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop copying a master (unsubscribe)' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
  @ApiResponse({ status: 200, description: 'Unsubscribed' })
  @ApiErrorResponses()
  unsubscribe(
    @Req() req: { user: JwtPayload },
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<CopySubscription> {
    return this.socialTradingService.unsubscribe(
      req.user.userId,
      subscriptionId,
    );
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List my live copy subscriptions' })
  @ApiQuery({ name: 'all', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Subscription list returned' })
  @ApiErrorResponses()
  listMySubscriptions(
    @Req() req: { user: JwtPayload },
    @Query('all') all?: string,
  ): Promise<CopySubscription[]> {
    return this.socialTradingService.listMySubscriptions(
      req.user.userId,
      all !== 'true',
    );
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get the Sortino-ranked public trader leaderboard',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Leaderboard returned' })
  @ApiErrorResponses()
  getLeaderboard(
    @Query('limit') limit?: string,
  ): Promise<LeaderboardEntryDto[]> {
    const parsed = limit ? parseInt(limit, 10) : 50;
    const safeLimit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(200, parsed) : 50;
    return this.leaderboardService.getLeaderboard(safeLimit, 3);
  }

  // ─── Social Feed ─────────────────────────────────────────────────────

  @Get('feed')
  @ApiOperation({
    summary: 'Get the social feed (recent master trades for followed traders)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Feed returned' })
  @ApiErrorResponses()
  getFeed(
    @Req() req: { user: JwtPayload },
    @Query('limit') limit?: string,
  ): Promise<SocialFeedEntryDto[]> {
    const parsed = limit ? parseInt(limit, 10) : 50;
    const safeLimit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(200, parsed) : 50;
    return this.socialTradingService.getSocialFeed(req.user.userId, safeLimit);
  }
}
