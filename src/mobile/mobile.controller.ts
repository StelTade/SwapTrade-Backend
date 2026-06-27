import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

import { MobileService } from './services/mobile.service';
import { FcmService } from './services/fcm.service';
import { AppVersionService } from './services/app-version.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { MobileAnalyticsService } from './services/mobile-analytics.service';

import {
  BatchSyncDto,
  BatchTrackDto,
  BiometricChallengeDto,
  BiometricVerifyDto,
  CheckVersionDto,
  CreateAppVersionDto,
  RegisterDeviceDto,
  SendPushDto,
  TrackEventDto,
} from './dto/mobile.dto';

@ApiTags('mobile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('mobile')
export class MobileController {
  constructor(
    private readonly mobileService: MobileService,
    private readonly fcmService: FcmService,
    private readonly versionService: AppVersionService,
    private readonly syncService: OfflineSyncService,
    private readonly analyticsService: MobileAnalyticsService,
  ) {}

  // ─── Device Registration ────────────────────────────────────────────────────

  @Post('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or refresh an FCM device token' })
  @ApiResponse({ status: 200, description: 'Device registered' })
  registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.mobileService.registerDevice(user.userId, dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List registered devices for the current user' })
  listDevices(@CurrentUser() user: JwtPayload) {
    return this.mobileService.listDevices(user.userId);
  }

  @Delete('devices/:fcmToken')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deregister a device token' })
  removeDevice(
    @CurrentUser() user: JwtPayload,
    @Param('fcmToken') fcmToken: string,
  ) {
    return this.mobileService.removeDevice(user.userId, fcmToken);
  }

  // ─── App Version Check ──────────────────────────────────────────────────────

  @Public()
  @Post('version/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if the client app version is up to date' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        upToDate: false,
        forceUpdate: true,
        latestVersion: '2.0.0',
        minimumVersion: '1.5.0',
        updateMessage: 'Critical security update required',
        storeUrl: 'https://apps.apple.com/...',
      },
    },
  })
  checkVersion(@Body() dto: CheckVersionDto) {
    return this.versionService.check(dto.platform, dto.version);
  }

  @Post('version')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new app version record (admin)' })
  createVersion(@Body() dto: CreateAppVersionDto) {
    return this.versionService.create(dto);
  }

  @Get('version')
  @ApiOperation({ summary: 'List all app version records' })
  listVersions() {
    return this.versionService.findAll();
  }

  @Delete('version/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an app version record' })
  deactivateVersion(@Param('id') id: string) {
    return this.versionService.deactivate(id);
  }

  // ─── Push Notifications ─────────────────────────────────────────────────────

  @Post('push/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a push notification to a user (internal/admin)',
  })
  sendPush(@Body() dto: SendPushDto) {
    return this.fcmService.sendToUser(dto.userId, {
      title: dto.title,
      body: dto.body,
      data: dto.data,
      deepLink: dto.deepLink,
    });
  }

  // ─── Offline Sync ───────────────────────────────────────────────────────────

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a batch of offline mutations for sync' })
  @ApiResponse({
    status: 200,
    schema: { example: { queued: 3, conflicts: ['order-uuid-1'] } },
  })
  syncBatch(@CurrentUser() user: JwtPayload, @Body() dto: BatchSyncDto) {
    return this.syncService.enqueueBatch(user.userId, dto);
  }

  @Post('sync/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger processing of the pending sync queue' })
  processPending(@CurrentUser() user: JwtPayload) {
    return this.syncService.processPending(user.userId);
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Get pending sync item count and history' })
  async syncStatus(@CurrentUser() user: JwtPayload) {
    const [pending, history] = await Promise.all([
      this.syncService.getPendingCount(user.userId),
      this.syncService.getHistory(user.userId),
    ]);
    return { pending, history };
  }

  // ─── Mobile Analytics ───────────────────────────────────────────────────────

  @Post('analytics/track')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a single mobile analytics event' })
  track(@CurrentUser() user: JwtPayload, @Body() dto: TrackEventDto) {
    return this.analyticsService.track(user.userId, dto);
  }

  @Post('analytics/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track multiple analytics events in one request' })
  trackBatch(@CurrentUser() user: JwtPayload, @Body() dto: BatchTrackDto) {
    return this.analyticsService.trackBatch(user.userId, dto);
  }

  @Get('analytics/stats')
  @ApiOperation({ summary: 'Aggregated mobile analytics (admin)' })
  @ApiQuery({ name: 'from', type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'to', type: String, example: '2026-12-31' })
  getStats(@Query('from') from: string, @Query('to') to: string) {
    return this.analyticsService.getStats(new Date(from), new Date(to));
  }

  // ─── Biometric Auth ─────────────────────────────────────────────────────────

  @Post('biometric/challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a biometric auth challenge' })
  @ApiResponse({
    status: 200,
    schema: { example: { challenge: 'base64url-encoded-random-bytes' } },
  })
  biometricChallenge(@Body() dto: BiometricChallengeDto) {
    return this.mobileService.issueChallenge(dto.deviceId);
  }

  @Post('biometric/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify biometric signature and authenticate' })
  @ApiResponse({ status: 200, schema: { example: { valid: true } } })
  biometricVerify(@Body() dto: BiometricVerifyDto) {
    return this.mobileService.verifyBiometric(dto);
  }

  // ─── Deep Link ──────────────────────────────────────────────────────────────

  @Public()
  @Get('deeplink/resolve')
  @ApiOperation({
    summary: 'Resolve a deep link path to an app screen + params',
  })
  @ApiQuery({ name: 'path', example: '/trade/BTC-USD' })
  resolveDeepLink(@Query('path') linkPath: string) {
    return resolveDeepLinkPath(linkPath);
  }
}

/** Stateless deep-link resolution: maps URL paths to app screen names. */
function resolveDeepLinkPath(linkPath: string): {
  screen: string;
  params: Record<string, string>;
} {
  const routes: Array<{
    pattern: RegExp;
    screen: string;
    paramKeys: string[];
  }> = [
    {
      pattern: /^\/trade\/([A-Z]+-[A-Z]+)$/,
      screen: 'TradeScreen',
      paramKeys: ['pair'],
    },
    {
      pattern: /^\/order\/([a-z0-9-]+)$/,
      screen: 'OrderDetailScreen',
      paramKeys: ['orderId'],
    },
    {
      pattern: /^\/profile\/([a-z0-9-]+)$/,
      screen: 'ProfileScreen',
      paramKeys: ['userId'],
    },
    {
      pattern: /^\/referral\/([A-Z0-9]+)$/,
      screen: 'ReferralScreen',
      paramKeys: ['code'],
    },
    {
      pattern: /^\/verify\/email$/,
      screen: 'EmailVerifyScreen',
      paramKeys: [],
    },
    {
      pattern: /^\/reset-password$/,
      screen: 'ResetPasswordScreen',
      paramKeys: [],
    },
  ];

  for (const route of routes) {
    const match = linkPath.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramKeys.forEach((key, i) => {
        params[key] = match[i + 1] ?? '';
      });
      return { screen: route.screen, params };
    }
  }

  return { screen: 'HomeScreen', params: {} };
}
