import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { UpdatePreferencesDto } from './dto/notification.dto';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationChannel } from './entities/notification.entity';
import { NotificationStatus } from '../common/enums/notification-status.enum';

interface ChannelPreferenceDto {
  type: string;
  channel: NotificationChannel;
  enabled: boolean;
}

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification sent' })
  send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get per-channel notification preferences for a user' })
  @ApiResponse({ status: 200, description: 'Notification preferences array' })
  getPreferences(@Param('userId') userId: string): Promise<NotificationPreference[]> {
    return this.notificationService.getPreferences(Number(userId));
  }

  @Patch('preferences/:userId')
  @ApiOperation({ summary: 'Update per-channel notification preferences for a user' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  updatePreferences(
    @Param('userId') userId: string,
    @Body() body: ChannelPreferenceDto[],
  ) {
    return this.notificationService.updatePreferences(Number(userId), body);
  }

  @Get('settings/:userId')
  @ApiOperation({ summary: 'Get high-level notification settings for a user (frequency, channels, type toggles)' })
  @ApiResponse({ status: 200, description: 'User notification settings' })
  getUserSettings(@Param('userId') userId: string) {
    return this.notificationService.getUserNotificationPreferences(userId);
  }

  @Patch('settings/:userId')
  @ApiOperation({ summary: 'Update high-level notification settings for a user' })
  @ApiResponse({ status: 200, description: 'Updated notification settings' })
  updateUserSettings(
    @Param('userId') userId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdatePreferencesDto,
  ) {
    return this.notificationService.updateUserNotificationPreferences(userId, dto);
  }

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from notifications via token' })
  @ApiQuery({ name: 'token', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Unsubscribed successfully' })
  unsubscribe(@Query('token') token: string) {
    return this.notificationService.unsubscribeByToken(token);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get notifications for a user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  getNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: NotificationStatus,
  ) {
    return this.notificationService.getNotifications(Number(userId), {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      status,
    });
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiBody({ schema: { properties: { userId: { type: 'number' } }, required: ['userId'] } })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markAsRead(
    @Param('notificationId') notificationId: string,
    @Body('userId') userId: number,
  ) {
    return this.notificationService.markAsRead(Number(notificationId), Number(userId));
  }
}
