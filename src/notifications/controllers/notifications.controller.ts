import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../../auth/guards/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';
import { UpdateNotificationPreferencesDto } from '../dto/update-notification-preferences.dto';
import { MarkNotificationReadDto } from '../dto/mark-notification-read.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  async getPreferences(@CurrentUser('sub', ParseUUIDPipe) userId: string) {
    return this.notificationsService.getUserPreferences(userId);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, updateDto);
  }

  @Get()
  async getNotifications(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationsService.getUserNotifications(userId, page, limit);
  }

  @Put(':id/mark-read')
  async markAsRead(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }
}